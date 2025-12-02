using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class StationsEndpoints
{
    // allowed station types – keep in sync with front + SQL
    static readonly HashSet<string> StationTypes = new(StringComparer.Ordinal)
    {
    "Bar",
    "Floor",
    "Kitchen",
    "Checker",
    "Hostes",
    "selector",
    "Storage",
    "Managment"
    };



    public static void MapStationsEndpoints(this WebApplication app)
    {

        var jsonOptionsCamel = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /* ------------------------------------------------------
 * GET /api/stations  -> list all stations
 * ---------------------------------------------------- */
        app.MapGet("/api/stations", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
            SELECT station_id, station_name, station_type
            FROM stations
            ORDER BY station_name;
        ";

                var list = new List<StationDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    list.Add(new StationDto
                    {
                        StationId = reader.GetGuid(0),
                        StationName = reader.GetString(1),
                        StationType = reader.GetString(2)
                    });
                }

                return Results.Json(
                    list,
                    jsonOptionsCamel  // the JsonSerializerOptions with CamelCase you defined earlier
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/stations:\n" + ex);
                return Results.Problem($"GET /api/stations failed: {ex.Message}", statusCode: 500);
            }
        });


        /* ------------------------------------------------------
         * POST /api/stations  -> create a new station
         * ---------------------------------------------------- */
        app.MapPost("/api/stations", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreateStationRequest>();
                if (body is null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var name = (body.StationName ?? string.Empty).Trim();
                var type = (body.StationType ?? string.Empty).Trim();

                if (name.Length == 0)
                    return Results.BadRequest(new { error = "StationName is required." });

                if (!StationTypes.Contains(type))
                {
                    return Results.BadRequest(new
                    {
                        error = "Invalid station type.",
                        allowedTypes = StationTypes.ToArray()
                    });
                }

                const string sql = @"
            INSERT INTO stations (station_name, station_type)
            VALUES (@name, @type)
            RETURNING station_id, station_name, station_type;
        ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("type", type);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.Problem("Failed to insert station.", statusCode: 500);
                }

                var dto = new StationDto
                {
                    StationId = reader.GetGuid(0),
                    StationName = reader.GetString(1),
                    StationType = reader.GetString(2)
                };

                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/stations:\n" + ex);
                return Results.Problem($"POST /api/stations failed: {ex.Message}", statusCode: 500);
            }
        });

        /* ------------------------------------------------------
         * DELETE /api/stations/{stationId}
         * ---------------------------------------------------- */
        app.MapDelete("/api/stations/{stationId:guid}", async (Guid stationId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
            DELETE FROM stations
            WHERE station_id = @id;
        ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("id", stationId);

                var rows = await cmd.ExecuteNonQueryAsync();

                if (rows == 0)
                    return Results.NotFound(new { error = "Station not found." });

                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/stations/{stationId}:\n" + ex);
                return Results.Problem($"DELETE /api/stations failed: {ex.Message}", statusCode: 500);
            }
        });
    }
}
