using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class RevenueCentersEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static void MapRevenueCentersEndpoints(this WebApplication app)
    {
        app.MapGet("/api/revenue-centers", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = """
                    select
                      rc.revenue_center_id,
                      rc.name,
                      checker.station_id as checker_station_id,
                      checker.station_name as checker_station_name,
                      member.station_id as member_station_id,
                      member.station_name as member_station_name,
                      member.station_type as member_station_type
                    from revenue_centers rc
                    left join stations checker
                      on checker.station_type = 'Checker'
                     and checker.checker_revenue_center_id = rc.revenue_center_id
                    left join stations member
                      on member.revenue_center_id = rc.revenue_center_id
                     and member.station_type in ('Bar', 'Floor')
                    order by lower(rc.name), lower(member.station_name) nulls last;
                    """;

                var map = new Dictionary<Guid, RevenueCenterDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    var revenueCenterId = reader.GetGuid(0);
                    if (!map.TryGetValue(revenueCenterId, out var dto))
                    {
                        dto = new RevenueCenterDto
                        {
                            RevenueCenterId = revenueCenterId,
                            Name = reader.GetString(1),
                            CheckerStationId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                            CheckerStationName = reader.IsDBNull(3) ? null : reader.GetString(3),
                            Stations = new List<RevenueCenterStationDto>()
                        };
                        map.Add(revenueCenterId, dto);
                    }

                    if (!reader.IsDBNull(4))
                    {
                        dto.Stations.Add(new RevenueCenterStationDto
                        {
                            StationId = reader.GetGuid(4),
                            StationName = reader.GetString(5),
                            StationType = reader.GetString(6)
                        });
                    }
                }

                return Results.Json(map.Values.ToList(), JsonOptions);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/revenue-centers:\n" + ex);
                return Results.Problem("GET /api/revenue-centers failed", statusCode: 500);
            }
        });

        app.MapPost("/api/revenue-centers", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreateRevenueCenterRequest>();
                var name = (body?.Name ?? string.Empty).Trim();

                if (name.Length == 0)
                    return Results.BadRequest(new { error = "Name is required." });

                const string sql = """
                    insert into revenue_centers (name)
                    values (@name)
                    returning revenue_center_id, name;
                    """;

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", name);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                    return Results.Problem("Failed to create revenue center.", statusCode: 500);

                var dto = new RevenueCenterDto
                {
                    RevenueCenterId = reader.GetGuid(0),
                    Name = reader.GetString(1),
                    Stations = new List<RevenueCenterStationDto>()
                };

                return Results.Json(dto, JsonOptions);
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return Results.BadRequest(new { error = "A revenue center with this name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/revenue-centers:\n" + ex);
                return Results.Problem("POST /api/revenue-centers failed", statusCode: 500);
            }
        });

        app.MapPatch("/api/revenue-centers/{revenueCenterId:guid}", async (Guid revenueCenterId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<UpdateRevenueCenterRequest>();
                var name = (body?.Name ?? string.Empty).Trim();

                if (name.Length == 0)
                    return Results.BadRequest(new { error = "Name is required." });

                const string sql = """
                    update revenue_centers
                    set name = @name
                    where revenue_center_id = @revenue_center_id
                    returning revenue_center_id, name;
                    """;

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                    return Results.NotFound(new { error = "Revenue center not found." });

                return Results.Json(new RevenueCenterDto
                {
                    RevenueCenterId = reader.GetGuid(0),
                    Name = reader.GetString(1),
                    Stations = new List<RevenueCenterStationDto>()
                }, JsonOptions);
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return Results.BadRequest(new { error = "A revenue center with this name already exists." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PATCH /api/revenue-centers/{revenueCenterId}:\n" + ex);
                return Results.Problem("PATCH /api/revenue-centers failed", statusCode: 500);
            }
        });

        app.MapDelete("/api/revenue-centers/{revenueCenterId:guid}", async (Guid revenueCenterId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = "delete from revenue_centers where revenue_center_id = @revenue_center_id;";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId);
                var rows = await cmd.ExecuteNonQueryAsync();

                return rows == 0
                    ? Results.NotFound(new { error = "Revenue center not found." })
                    : Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/revenue-centers/{revenueCenterId}:\n" + ex);
                return Results.Problem("DELETE /api/revenue-centers failed", statusCode: 500);
            }
        });

        app.MapPost("/api/revenue-centers/{revenueCenterId:guid}/stations", async (Guid revenueCenterId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<AssignRevenueCenterStationRequest>();
                if (body is null || body.StationId == Guid.Empty)
                    return Results.BadRequest(new { error = "StationId is required." });

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                const string revenueCenterExistsSql = """
                    select 1
                    from revenue_centers
                    where revenue_center_id = @revenue_center_id
                    limit 1;
                    """;

                await using (var revenueCenterCmd = new NpgsqlCommand(revenueCenterExistsSql, conn, tx))
                {
                    revenueCenterCmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId);
                    if (await revenueCenterCmd.ExecuteScalarAsync() is null)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Revenue center not found." });
                    }
                }

                const string stationSql = """
                    select station_type
                    from stations
                    where station_id = @station_id
                    limit 1;
                    """;

                string? stationType = null;
                await using (var stationCmd = new NpgsqlCommand(stationSql, conn, tx))
                {
                    stationCmd.Parameters.AddWithValue("station_id", body.StationId);
                    stationType = await stationCmd.ExecuteScalarAsync() as string;
                }

                if (stationType is null)
                {
                    await tx.RollbackAsync();
                    return Results.NotFound(new { error = "Station not found." });
                }

                if (stationType is not ("Bar" or "Floor"))
                {
                    await tx.RollbackAsync();
                    return Results.BadRequest(new { error = "Only Bar or Floor stations can be assigned to a revenue center." });
                }

                const string updateSql = """
                    update stations
                    set revenue_center_id = @revenue_center_id
                    where station_id = @station_id;
                    """;

                await using (var updateCmd = new NpgsqlCommand(updateSql, conn, tx))
                {
                    updateCmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId);
                    updateCmd.Parameters.AddWithValue("station_id", body.StationId);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();
                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/revenue-centers/{revenueCenterId}/stations:\n" + ex);
                return Results.Problem("Assigning station to revenue center failed.", statusCode: 500);
            }
        });

        app.MapDelete("/api/revenue-centers/{revenueCenterId:guid}/stations/{stationId:guid}", async (Guid revenueCenterId, Guid stationId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = """
                    update stations
                    set revenue_center_id = null
                    where station_id = @station_id
                      and revenue_center_id = @revenue_center_id
                      and station_type in ('Bar', 'Floor');
                    """;

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("station_id", stationId);
                cmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId);
                var rows = await cmd.ExecuteNonQueryAsync();

                return rows == 0
                    ? Results.NotFound(new { error = "Assigned station link not found." })
                    : Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/revenue-centers/{revenueCenterId}/stations/{stationId}:\n" + ex);
                return Results.Problem("Removing station from revenue center failed.", statusCode: 500);
            }
        });
    }
}
