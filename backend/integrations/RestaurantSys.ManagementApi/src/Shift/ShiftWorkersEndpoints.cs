using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class ShiftWorkersEndpoints
{
    public static void MapShiftWorkersEndpoints(this WebApplication app)
    {
        /* ===========================================
           GET /api/shifts/{shiftId}/workers
           Returns all shift_workers rows for the shift
        ============================================*/
        app.MapGet("/api/shifts/{shiftId:guid}/workers", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select sw.shift_worker_id,
                           sw.shift_id,
                           sw.worker_id,
                           sw.station_id,
                           sw.position_snapshot,
                           sw.salary_cents_snapshot,
                           sw.started_at,
                           sw.ended_at,
                           sw.device_type,
                           w.first_name,
                           w.last_name
                      from shift_workers sw
                 left join workers w on w.worker_id = sw.worker_id
                     where sw.shift_id = @shift_id
                     order by coalesce(sw.ended_at, sw.started_at) desc;";

                var list = new List<object>();
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var first = reader.IsDBNull(9) ? "" : reader.GetString(9);
                    var last = reader.IsDBNull(10) ? "" : reader.GetString(10);
                    list.Add(new
                    {
                        shiftWorkerId = reader.GetGuid(0),
                        shiftId = reader.GetGuid(1),
                        workerId = reader.GetGuid(2),
                        stationId = reader.IsDBNull(3) ? (Guid?)null : reader.GetGuid(3),
                        positionSnapshot = reader.GetString(4),
                        salaryCentsSnapshot = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                        startedAt = reader.GetDateTime(6),
                        endedAt = reader.IsDBNull(7) ? (DateTime?)null : reader.GetDateTime(7),
                        deviceType = reader.GetString(8),
                        name = string.Join(" ", new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                    });
                }

                return Results.Json(list, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/workers:\n" + ex);
                return Results.Problem("Failed to get shift workers.", statusCode: 500);
            }
        });

        /* ===========================================
           GET /api/shifts/{shiftId}/workers/active
           Returns only active (not ended) shift_workers for the shift
        ============================================*/
        app.MapGet("/api/shifts/{shiftId:guid}/workers/active", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select sw.shift_worker_id,
                           sw.shift_id,
                           sw.worker_id,
                           sw.station_id,
                           sw.position_snapshot,
                           sw.salary_cents_snapshot,
                           sw.started_at,
                           sw.device_type,
                           w.first_name,
                           w.last_name
                      from shift_workers sw
                 left join workers w on w.worker_id = sw.worker_id
                     where sw.shift_id = @shift_id
                       and sw.ended_at is null
                     order by sw.started_at desc;";

                var list = new List<object>();
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var first = reader.IsDBNull(8) ? "" : reader.GetString(8);
                    var last = reader.IsDBNull(9) ? "" : reader.GetString(9);
                    list.Add(new
                    {
                        shiftWorkerId = reader.GetGuid(0),
                        shiftId = reader.GetGuid(1),
                        workerId = reader.GetGuid(2),
                        stationId = reader.IsDBNull(3) ? (Guid?)null : reader.GetGuid(3),
                        positionSnapshot = reader.GetString(4),
                        salaryCentsSnapshot = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                        startedAt = reader.GetDateTime(6),
                        deviceType = reader.GetString(7),
                        name = string.Join(" ", new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                    });
                }

                return Results.Json(list, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/workers/active:\n" + ex);
                return Results.Problem("Failed to get active shift workers.", statusCode: 500);
            }
        });

        /* ===========================================
           POST /api/shifts/{shiftId}/workers/clock-in
           Body: { workerId: uuid, stationId?: uuid, deviceType: "fixed"|"personal" }
           - Ensures no active row exists for this (shift, worker)
           - Snapshots position & salary from workers
           - Inserts row with started_at = now()
        ============================================*/
        app.MapPost("/api/shifts/{shiftId:guid}/workers/clock-in", async (Guid shiftId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                if (!body.TryGetProperty("workerId", out var wIdEl) || wIdEl.ValueKind != JsonValueKind.String || !Guid.TryParse(wIdEl.GetString(), out var workerId))
                    return Results.BadRequest(new { error = "workerId is required." });

                Guid? stationId = null;
                if (body.TryGetProperty("stationId", out var sIdEl) && sIdEl.ValueKind == JsonValueKind.String && Guid.TryParse(sIdEl.GetString(), out var parsed))
                    stationId = parsed;

                var deviceType = body.TryGetProperty("deviceType", out var dEl) && dEl.ValueKind == JsonValueKind.String
                    ? dEl.GetString()!.Trim().ToLowerInvariant()
                    : "fixed";

                if (deviceType != "fixed" && deviceType != "personal")
                    return Results.BadRequest(new { error = "deviceType must be 'fixed' or 'personal'." });

                // Ensure shift is active
                const string shiftSql = @"select status from shifts where shift_id = @shift_id limit 1;";
                await using (var checkShift = db.CreateCommand(shiftSql))
                {
                    checkShift.Parameters.AddWithValue("shift_id", shiftId);
                    var statusObj = await checkShift.ExecuteScalarAsync();
                    var status = statusObj as string;
                    if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                        return Results.BadRequest(new { error = "Shift is not active." });
                }

                // Prevent duplicate active row for (shift, worker)
                const string dupSql = @"
                    select count(*) 
                      from shift_workers 
                     where shift_id = @shift_id and worker_id = @worker_id and ended_at is null;";
                await using (var dup = db.CreateCommand(dupSql))
                {
                    dup.Parameters.AddWithValue("shift_id", shiftId);
                    dup.Parameters.AddWithValue("worker_id", workerId);
                    var c = Convert.ToInt64(await dup.ExecuteScalarAsync());
                    if (c > 0) return Results.BadRequest(new { error = "Worker is already clocked in for this shift." });
                }

                // Snapshot from workers
                string positionSnapshot = "Worker";
                int? salaryCentsSnapshot = null;

                const string workerSql = @"
                    select position, salary_cents
                      from workers
                     where worker_id = @worker_id
                     limit 1;";
                await using (var wcmd = db.CreateCommand(workerSql))
                {
                    wcmd.Parameters.AddWithValue("worker_id", workerId);
                    await using var reader = await wcmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                        return Results.BadRequest(new { error = "Worker not found." });

                    positionSnapshot = reader.IsDBNull(0) ? "Worker" : reader.GetString(0);
                    salaryCentsSnapshot = reader.IsDBNull(1) ? (int?)null : reader.GetInt32(1);
                }

                // Insert shift_worker
                const string insSql = @"
                    insert into shift_workers
                        (shift_id, worker_id, station_id, position_snapshot, salary_cents_snapshot, started_at, device_type, created_at)
                    values
                        (@shift_id, @worker_id, @station_id, @pos, @salary, now(), @device_type, now())
                    returning shift_worker_id, started_at;";

                Guid shiftWorkerId;
                DateTime startedAt;

                await using (var icmd = db.CreateCommand(insSql))
                {
                    icmd.Parameters.AddWithValue("shift_id", shiftId);
                    icmd.Parameters.AddWithValue("worker_id", workerId);
                    if (stationId is null)
                        icmd.Parameters.AddWithValue("station_id", DBNull.Value);
                    else
                        icmd.Parameters.AddWithValue("station_id", stationId.Value);
                    icmd.Parameters.AddWithValue("pos", positionSnapshot);
                    if (salaryCentsSnapshot is null)
                        icmd.Parameters.AddWithValue("salary", DBNull.Value);
                    else
                        icmd.Parameters.AddWithValue("salary", salaryCentsSnapshot.Value);
                    icmd.Parameters.AddWithValue("device_type", deviceType);

                    await using var r = await icmd.ExecuteReaderAsync();
                    if (!await r.ReadAsync())
                        return Results.Problem("Failed to clock in.", statusCode: 500);

                    shiftWorkerId = r.GetGuid(0);
                    startedAt = r.GetDateTime(1);
                }

                return Results.Json(new
                {
                    shiftWorkerId,
                    shiftId,
                    workerId,
                    stationId,
                    positionSnapshot,
                    salaryCentsSnapshot,
                    startedAt,
                    deviceType
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/shifts/{shiftId}/workers/clock-in:\n" + ex);
                return Results.Problem("Clock-in failed.", statusCode: 500);
            }
        });

        /* ===========================================
           POST /api/shifts/{shiftId}/workers/clock-out
           Body: { workerId: uuid }
           - If there is an active row (ended_at IS NULL) → set ended_at = now()
           - If none → 400
        ============================================*/
        app.MapPost("/api/shifts/{shiftId:guid}/workers/clock-out", async (Guid shiftId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                if (!body.TryGetProperty("workerId", out var wIdEl) || wIdEl.ValueKind != JsonValueKind.String || !Guid.TryParse(wIdEl.GetString(), out var workerId))
                    return Results.BadRequest(new { error = "workerId is required." });

                const string updSql = @"
                    update shift_workers
                       set ended_at = now()
                     where shift_id = @shift_id
                       and worker_id = @worker_id
                       and ended_at is null
                 returning shift_worker_id, started_at, ended_at;";

                Guid shiftWorkerId;
                DateTime startedAt;
                DateTime endedAt;

                await using (var ucmd = db.CreateCommand(updSql))
                {
                    ucmd.Parameters.AddWithValue("shift_id", shiftId);
                    ucmd.Parameters.AddWithValue("worker_id", workerId);

                    await using var r = await ucmd.ExecuteReaderAsync();
                    if (!await r.ReadAsync())
                        return Results.BadRequest(new { error = "Worker is not clocked in for this shift." });

                    shiftWorkerId = r.GetGuid(0);
                    startedAt = r.GetDateTime(1);
                    endedAt = r.GetDateTime(2);
                }

                return Results.Json(new
                {
                    shiftWorkerId,
                    shiftId,
                    workerId,
                    startedAt,
                    endedAt
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/shifts/{shiftId}/workers/clock-out:\n" + ex);
                return Results.Problem("Clock-out failed.", statusCode: 500);
            }
        });
    }
}
