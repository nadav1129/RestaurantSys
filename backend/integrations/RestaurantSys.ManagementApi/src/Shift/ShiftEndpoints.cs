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
    }
}
