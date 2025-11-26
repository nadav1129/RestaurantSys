using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class ShiftEndpoints
{
    public static void MapShiftEndpoints(this WebApplication app)
    {
        /* =========================================
           SHIFTS
           ========================================= */

        // GET /api/shifts/active
        app.MapGet("/api/shifts/active", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select shift_id, name, started_at, ended_at, status, created_at
                    from shifts
                    where status = 'active'
                    order by started_at desc nulls last, created_at desc
                    limit 1;
                ";

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    // No active shift -> return null
                    return Results.Json(
                        (object?)null,
                        new JsonSerializerOptions
                        {
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        }
                    );
                }

                var shift = new
                {
                    ShiftId = reader.GetGuid(0),
                    Name = reader.IsDBNull(1) ? null : reader.GetString(1),
                    StartedAt = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2),
                    EndedAt = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                    Status = reader.GetString(4),
                    CreatedAt = reader.GetDateTime(5)
                };

                return Results.Json(
                    shift,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/active:\n" + ex);
                return Results.Problem("GET /api/shifts/active failed", statusCode: 500);
            }
        });

        // POST /api/shifts  (start new shift)
        app.MapPost("/api/shifts", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                string? name = null;

                if (body.ValueKind == JsonValueKind.Object &&
                    body.TryGetProperty("name", out var p) &&
                    p.ValueKind == JsonValueKind.String)
                {
                    var s = p.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                        name = s.Trim();
                }

                const string sql = @"
                    insert into shifts (name, status, started_at)
                    values (@name, 'active', now())
                    returning shift_id, name, started_at, ended_at, status, created_at;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", (object?)name ?? DBNull.Value);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.Problem("Failed to create shift.", statusCode: 500);
                }

                var shift = new
                {
                    ShiftId = reader.GetGuid(0),
                    Name = reader.IsDBNull(1) ? null : reader.GetString(1),
                    StartedAt = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2),
                    EndedAt = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                    Status = reader.GetString(4),
                    CreatedAt = reader.GetDateTime(5)
                };

                return Results.Json(
                    shift,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/shifts:\n" + ex);
                return Results.Problem("POST /api/shifts failed", statusCode: 500);
            }
        });

        // POST /api/shifts/{shiftId}/close
        app.MapPost("/api/shifts/{shiftId:guid}/close", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    update shifts
                    set status = 'closed',
                        ended_at = coalesce(ended_at, now())
                    where shift_id = @shift_id
                    returning shift_id, name, started_at, ended_at, status, created_at;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound(new { error = "Shift not found." });
                }

                var shift = new
                {
                    ShiftId = reader.GetGuid(0),
                    Name = reader.IsDBNull(1) ? null : reader.GetString(1),
                    StartedAt = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2),
                    EndedAt = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                    Status = reader.GetString(4),
                    CreatedAt = reader.GetDateTime(5)
                };

                return Results.Json(
                    shift,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/shifts/{shiftId}/close:\n" + ex);
                return Results.Problem("Close shift failed.", statusCode: 500);
            }
        });

        // GET /api/shifts  (list all shifts, newest first)
        app.MapGet("/api/shifts", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select shift_id, name, started_at, ended_at, status, created_at
                    from shifts
                    order by started_at desc nulls last, created_at desc;
                ";

                var list = new List<object>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new
                    {
                        ShiftId = reader.GetGuid(0),
                        Name = reader.IsDBNull(1) ? null : reader.GetString(1),
                        StartedAt = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2),
                        EndedAt = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                        Status = reader.GetString(4),
                        CreatedAt = reader.GetDateTime(5)
                    });
                }

                return Results.Json(
                    list,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts:\n" + ex);
                return Results.Problem("GET /api/shifts failed", statusCode: 500);
            }
        });

        /* =========================================
           SHIFT WORKERS (clock in / out)
           ========================================= */

        // GET /api/shifts/{shiftId}/workers
        app.MapGet("/api/shifts/{shiftId:guid}/workers", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select
                      sw.shift_worker_id,
                      sw.worker_id,
                      w.first_name,
                      w.last_name,
                      sw.position_snapshot,
                      sw.salary_cents_snapshot,
                      sw.station_id,
                      s.station_name,
                      sw.device_type,
                      sw.started_at,
                      sw.ended_at
                    from shift_workers sw
                    join workers w on w.worker_id = sw.worker_id
                    left join stations s on s.station_id = sw.station_id
                    where sw.shift_id = @shift_id
                    order by sw.started_at;
                ";

                var list = new List<object>();

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new
                    {
                        ShiftWorkerId = reader.GetGuid(0),
                        WorkerId = reader.GetGuid(1),
                        FirstName = reader.GetString(2),
                        LastName = reader.GetString(3),
                        PositionSnapshot = reader.GetString(4),
                        SalaryCentsSnapshot = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                        StationId = reader.IsDBNull(6) ? (Guid?)null : reader.GetGuid(6),
                        StationName = reader.IsDBNull(7) ? null : reader.GetString(7),
                        DeviceType = reader.GetString(8),
                        StartedAt = reader.GetDateTime(9),
                        EndedAt = reader.IsDBNull(10) ? (DateTime?)null : reader.GetDateTime(10)
                    });
                }

                return Results.Json(
                    list,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/workers:\n" + ex);
                return Results.Problem("GET /api/shifts/{shiftId}/workers failed", statusCode: 500);
            }
        });

        // POST /api/shifts/{shiftId}/workers/clock-in
        // Body: { workerId: "guid", stationId?: "guid", deviceType?: "fixed" | "personal" }
        app.MapPost("/api/shifts/{shiftId:guid}/workers/clock-in", async (Guid shiftId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                if (!body.TryGetProperty("workerId", out var wProp) || wProp.ValueKind != JsonValueKind.String)
                    return Results.BadRequest(new { error = "workerId is required." });

                if (!Guid.TryParse(wProp.GetString(), out var workerId) || workerId == Guid.Empty)
                    return Results.BadRequest(new { error = "Invalid workerId." });

                Guid? stationId = null;
                if (body.TryGetProperty("stationId", out var sProp) && sProp.ValueKind == JsonValueKind.String)
                {
                    if (Guid.TryParse(sProp.GetString(), out var sid) && sid != Guid.Empty)
                        stationId = sid;
                }

                string deviceType = "fixed";
                if (body.TryGetProperty("deviceType", out var dProp) && dProp.ValueKind == JsonValueKind.String)
                {
                    var dt = (dProp.GetString() ?? "").Trim().ToLowerInvariant();
                    if (dt == "personal") deviceType = "personal";
                    else deviceType = "fixed";
                }

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                // 1) Check shift exists & is active
                const string checkShiftSql = @"
                    select status
                    from shifts
                    where shift_id = @shift_id
                    limit 1;
                ";
                await using (var checkShift = new NpgsqlCommand(checkShiftSql, conn, tx))
                {
                    checkShift.Parameters.AddWithValue("shift_id", shiftId);
                    var statusObj = await checkShift.ExecuteScalarAsync();
                    if (statusObj is null)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Shift not found." });
                    }

                    var status = (string)statusObj;
                    if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = "Shift is not active." });
                    }
                }

                // 2) Load worker snapshot (position, salary)
                string positionSnapshot;
                int? salarySnapshot;

                const string workerSql = @"
                    select position, salary_cents
                    from workers
                    where worker_id = @worker_id
                    limit 1;
                ";
                await using (var workerCmd = new NpgsqlCommand(workerSql, conn, tx))
                {
                    workerCmd.Parameters.AddWithValue("worker_id", workerId);
                    await using var reader = await workerCmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Worker not found." });
                    }

                    positionSnapshot = reader.GetString(0);
                    salarySnapshot = reader.IsDBNull(1) ? (int?)null : reader.GetInt32(1);
                }

                // 3) Ensure no open shift_worker for this worker+shift
                const string checkOpenSql = @"
                    select 1
                    from shift_workers
                    where shift_id = @shift_id
                      and worker_id = @worker_id
                      and ended_at is null
                    limit 1;
                ";
                await using (var openCmd = new NpgsqlCommand(checkOpenSql, conn, tx))
                {
                    openCmd.Parameters.AddWithValue("shift_id", shiftId);
                    openCmd.Parameters.AddWithValue("worker_id", workerId);
                    var exists = await openCmd.ExecuteScalarAsync();
                    if (exists is not null)
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = "Worker already clocked in for this shift." });
                    }
                }

                // 4) Insert shift_workers row
                const string insertSql = @"
                    insert into shift_workers
                      (shift_id, worker_id, station_id, position_snapshot, salary_cents_snapshot, started_at, device_type)
                    values
                      (@shift_id, @worker_id, @station_id, @position_snapshot, @salary_snapshot, now(), @device_type)
                    returning shift_worker_id, started_at;
                ";
                Guid shiftWorkerId;
                DateTime startedAt;

                await using (var insertCmd = new NpgsqlCommand(insertSql, conn, tx))
                {
                    insertCmd.Parameters.AddWithValue("shift_id", shiftId);
                    insertCmd.Parameters.AddWithValue("worker_id", workerId);
                    insertCmd.Parameters.AddWithValue("station_id", (object?)stationId ?? DBNull.Value);
                    insertCmd.Parameters.AddWithValue("position_snapshot", positionSnapshot);
                    insertCmd.Parameters.AddWithValue("salary_snapshot", (object?)salarySnapshot ?? DBNull.Value);
                    insertCmd.Parameters.AddWithValue("device_type", deviceType);

                    await using var reader = await insertCmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                    {
                        await tx.RollbackAsync();
                        return Results.Problem("Failed to clock in worker.", statusCode: 500);
                    }

                    shiftWorkerId = reader.GetGuid(0);
                    startedAt = reader.GetDateTime(1);
                }

                await tx.CommitAsync();

                var result = new
                {
                    ShiftWorkerId = shiftWorkerId,
                    ShiftId = shiftId,
                    WorkerId = workerId,
                    StationId = stationId,
                    DeviceType = deviceType,
                    StartedAt = startedAt
                };

                return Results.Json(
                    result,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/shifts/{shiftId}/workers/clock-in:\n" + ex);
                return Results.Problem("Clock-in failed.", statusCode: 500);
            }
        });

        // POST /api/shifts/{shiftId}/workers/clock-out
        // Body: { workerId: "guid" }
        app.MapPost("/api/shifts/{shiftId:guid}/workers/clock-out", async (Guid shiftId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                if (!body.TryGetProperty("workerId", out var wProp) || wProp.ValueKind != JsonValueKind.String)
                    return Results.BadRequest(new { error = "workerId is required." });

                if (!Guid.TryParse(wProp.GetString(), out var workerId) || workerId == Guid.Empty)
                    return Results.BadRequest(new { error = "Invalid workerId." });

                const string sql = @"
                    update shift_workers
                    set ended_at = now()
                    where shift_id = @shift_id
                      and worker_id = @worker_id
                      and ended_at is null;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);
                cmd.Parameters.AddWithValue("worker_id", workerId);

                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows == 0)
                {
                    return Results.NotFound(new { error = "No open shift record for this worker and shift." });
                }

                return Results.Json(new { success = true });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/shifts/{shiftId}/workers/clock-out:\n" + ex);
                return Results.Problem("Clock-out failed.", statusCode: 500);
            }
        });
    }
}
