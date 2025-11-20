using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class ListStationsEndpoints
{

    public static void MapListStationsEndpoints(this WebApplication app)
    {
        var jsonOptionsCamel = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /* ===========================
        * STATION ↔ LIST links
        * =========================== */

        // GET /api/stations/{stationId}/lists
        app.MapGet("/api/stations/{stationId:guid}/lists", async (Guid stationId, NpgsqlDataSource db) =>
        {
            const string sql = @"
        SELECT l.list_id, l.title, l.list_type
        FROM station_lists sl
        JOIN lists l ON l.list_id = sl.list_id
        WHERE sl.station_id = @sid
        ORDER BY l.created_at DESC;
    ";

            var rows = new List<ListDto>();
            await using var cmd = db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("sid", stationId);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add(new ListDto
                {
                    ListId = reader.GetGuid(0),
                    Title = reader.GetString(1),
                    ListType = reader.GetString(2)
                });
            }

            return Results.Json(rows, jsonOptionsCamel);
        });

        // POST /api/stations/{stationId}/lists   { listId }
        app.MapPost("/api/stations/{stationId:guid}/lists", async (Guid stationId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<JsonElement>();
                if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("listId", out var listProp))
                    return Results.BadRequest(new { error = "Missing listId." });

                if (!Guid.TryParse(listProp.GetString(), out var listId))
                    return Results.BadRequest(new { error = "Invalid listId." });

                const string sql = @"
            INSERT INTO station_lists (station_id, list_id)
            VALUES (@sid, @lid)
            ON CONFLICT DO NOTHING;
        ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("sid", stationId);
                cmd.Parameters.AddWithValue("lid", listId);
                await cmd.ExecuteNonQueryAsync();

                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/stations/{stationId}/lists:\n" + ex);
                return Results.Problem($"Attach list failed: {ex.Message}", statusCode: 500);
            }
        });

        // DELETE /api/stations/{stationId}/lists/{listId}
        app.MapDelete("/api/stations/{stationId:guid}/lists/{listId:guid}", async (Guid stationId, Guid listId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
            DELETE FROM station_lists
            WHERE station_id = @sid AND list_id = @lid;
        ";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("sid", stationId);
                cmd.Parameters.AddWithValue("lid", listId);

                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows == 0) return Results.NotFound(new { error = "Link not found." });

                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/stations/{stationId}/lists/{listId}:\n" + ex);
                return Results.Problem($"Detach list failed: {ex.Message}", statusCode: 500);
            }
        });

    }
}