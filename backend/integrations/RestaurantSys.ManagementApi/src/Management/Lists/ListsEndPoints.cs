using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class ListsEndpoints
{
    static readonly HashSet<string> ListTypes = new(StringComparer.Ordinal)
    {
        "Tables",
        "Names"
    };
    public static void MapListEndpoints(this WebApplication app)
    {
        var jsonOptionsCamel = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /* ------------------------------------------------------
         * GET /api/lists  -> get all lists (for page load / refresh)
         * ---------------------------------------------------- */
        app.MapGet("/api/lists", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
        SELECT list_id, title, list_type
        FROM lists
        ORDER BY created_at DESC;
    ";

                var result = new List<ListDto>();
                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    result.Add(new ListDto
                    {
                        ListId = reader.GetGuid(0),
                        Title = reader.GetString(1),
                        ListType = reader.GetString(2)
                    });
                }

                return Results.Json(result, jsonOptionsCamel);
            }
            catch(Exception ex) 
            {
                Console.Error.WriteLine("Error in GET /api/lists:\n" + ex);
                return Results.Problem($"GET /api/lists failed: {ex.Message}", statusCode: 500);
            }
        });

        /* ------------------------------------------------------
         * POST /api/lists  -> create a new list
         * Body: { title, listType: "Tables" | "Names" }
         * ---------------------------------------------------- */
        app.MapPost("/api/lists", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreateListRequest>();
                if (body is null) return Results.BadRequest(new { error = "Invalid JSON." });

                var title = (body.Title ?? string.Empty).Trim();
                var type = (body.ListType ?? string.Empty).Trim();

                if (title.Length == 0) return Results.BadRequest(new { error = "Title is required." });
                if (!ListTypes.Contains(type))
                    return Results.BadRequest(new { error = "Invalid list type.", allowed = ListTypes.ToArray() });

                const string sql = @"
            INSERT INTO lists (title, list_type)
            VALUES (@title, @type)
            RETURNING list_id, title, list_type;
        ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("title", title);
                cmd.Parameters.AddWithValue("type", type);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                    return Results.Problem("Insert failed.", statusCode: 500);

                var dto = new ListDto
                {
                    ListId = reader.GetGuid(0),
                    Title = reader.GetString(1),
                    ListType = reader.GetString(2)
                };

                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/lists:\n" + ex);
                return Results.Problem($"POST /api/lists failed: {ex.Message}", statusCode: 500);
            }
        });

        /* ------------------------------------------------------
         * DELETE /api/lists/{listId}  -> delete a list (entries cascade)
         * ---------------------------------------------------- */
        app.MapDelete("/api/lists/{listId:guid}", async (Guid listId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"DELETE FROM lists WHERE list_id = @id;";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("id", listId);
                var rows = await cmd.ExecuteNonQueryAsync();

                if (rows == 0) return Results.NotFound(new { error = "List not found." });
                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/lists/{listId}:\n" + ex);
                return Results.Problem($"DELETE /api/lists failed: {ex.Message}", statusCode: 500);
            }
        });

        // PATCH /api/lists/{listId}   -> rename list
        app.MapPatch("/api/lists/{listId:guid}", async (Guid listId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {

                var body = await req.ReadFromJsonAsync<JsonElement>();
                if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("title", out var t))
                    return Results.BadRequest(new { error = "Missing title." });

                var title = (t.GetString() ?? "").Trim();
                if (title.Length == 0) return Results.BadRequest(new { error = "Title is required." });

                const string sql = @"
      UPDATE lists SET title = @title
      WHERE list_id = @id
      RETURNING list_id, title, list_type;
    ";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("title", title);
                cmd.Parameters.AddWithValue("id", listId);

                await using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync()) return Results.NotFound(new { error = "List not found." });

                var dto = new { listId = r.GetGuid(0), title = r.GetString(1), listType = r.GetString(2) };
                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PATCH /api/lists/{listId:guid}/entries/{entryId:guid}:\n" + ex);
                return Results.Problem($"PATCH /api/lists/{{listId:guid}}/entries/{{entryId:guid}} failed: {ex.Message}", statusCode: 500);
            }
        });

        /* ------------------------------------------------------
         * POST /api/lists/{listId}/dump  -> remove all entries but keep the list
         * ---------------------------------------------------- */
        app.MapPost("/api/lists/{listId:guid}/dump", async (Guid listId, NpgsqlDataSource db) =>
        {
            try
            {
                // Make sure list exists
                const string checkSql = @"SELECT 1 FROM lists WHERE list_id = @id;";
                await using (var check = db.CreateCommand(checkSql))
                {
                    check.Parameters.AddWithValue("id", listId);
                    await using var r = await check.ExecuteReaderAsync();
                    if (!await r.ReadAsync())
                        return Results.NotFound(new { error = "List not found." });
                }

                const string sql = @"DELETE FROM list_entries WHERE list_id = @id;";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("id", listId);
                await cmd.ExecuteNonQueryAsync();

                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/lists/{listId}/dump:\n" + ex);
                return Results.Problem($"DUMP list entries failed: {ex.Message}", statusCode: 500);
            }
        });

        /* ------------------------------------------------------
         * GET /api/lists/{listId}/entries  -> fetch entries for a list (for "Refresh list")
         * ---------------------------------------------------- */
        app.MapGet("/api/lists/{listId:guid}/entries", async (Guid listId, NpgsqlDataSource db) =>
        {
            try
            {
                const string listCheck = @"SELECT list_type FROM lists WHERE list_id = @id;";
                await using (var check = db.CreateCommand(listCheck))
                {
                    check.Parameters.AddWithValue("id", listId);
                    await using var r = await check.ExecuteReaderAsync();
                    if (!await r.ReadAsync())
                        return Results.NotFound(new { error = "List not found." });
                }

                const string sql = @"
        SELECT
          entry_id, list_id, name, phone, note,
          num_people,
          to_char(start_time, 'HH24:MI') as start_time,
          to_char(end_time,   'HH24:MI') as end_time,
          minutes
        FROM list_entries
        WHERE list_id = @id
        ORDER BY created_at DESC, entry_id;
    ";

                var rows = new List<ListEntryDto>();
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("id", listId);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    rows.Add(new ListEntryDto
                    {
                        EntryId = reader.GetGuid(0),
                        ListId = reader.GetGuid(1),
                        Name = reader.GetString(2),
                        Phone = reader.GetString(3),
                        Note = reader.GetString(4),
                        NumPeople = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                        StartTime = reader.IsDBNull(6) ? null : reader.GetString(6), // "HH:MM"
                        EndTime = reader.IsDBNull(7) ? null : reader.GetString(7),
                        Minutes = reader.IsDBNull(8) ? (int?)null : reader.GetInt32(8)
                    });
                }

                return Results.Json(rows, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/lists:\n" + ex);
                return Results.Problem($"GET /api/lists failed: {ex.Message}", statusCode: 500);
            }
        });

        // POST /api/lists/{listId}/entries
        app.MapPost("/api/lists/{listId:guid}/entries", async (Guid listId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<JsonElement>();
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                string name = body.TryGetProperty("name", out var v1) ? (v1.GetString() ?? "").Trim() : "";
                string phone = body.TryGetProperty("phone", out var v2) ? (v2.GetString() ?? "").Trim() : "";
                string note = body.TryGetProperty("note", out var v3) ? (v3.GetString() ?? "").Trim() : "";
                int? numPeople = body.TryGetProperty("numPeople", out var v4) && v4.ValueKind != JsonValueKind.Null ? v4.GetInt32() : (int?)null;
                string? start = body.TryGetProperty("startTime", out var v5) && v5.ValueKind != JsonValueKind.Null ? v5.GetString() : null;
                string? end = body.TryGetProperty("endTime", out var v6) && v6.ValueKind != JsonValueKind.Null ? v6.GetString() : null;
                int? minutes = body.TryGetProperty("minutes", out var v7) && v7.ValueKind != JsonValueKind.Null ? v7.GetInt32() : (int?)null;

                const string sql = @"
  INSERT INTO list_entries (list_id, name, phone, note, num_people, start_time, end_time, minutes)
  VALUES (
    @list_id,
    @name,
    @phone,
    @note,
    NULLIF(@num_people::text, '')::int,
    NULLIF(@start::text, '')::time,
    NULLIF(@end::text,   '')::time,
    NULLIF(@minutes::text, '')::int
  )
  RETURNING entry_id, list_id, name, phone, note,
            num_people,
            to_char(start_time, 'HH24:MI') as start_time,
            to_char(end_time,   'HH24:MI') as end_time,
            minutes,
            arrived;
";


                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("list_id", listId);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("phone", phone);
                cmd.Parameters.AddWithValue("note", note);
                cmd.Parameters.AddWithValue("num_people", (object?)numPeople ?? DBNull.Value);
                cmd.Parameters.AddWithValue("start", (object?)start ?? DBNull.Value);
                cmd.Parameters.AddWithValue("end", (object?)end ?? DBNull.Value);
                cmd.Parameters.AddWithValue("minutes", (object?)minutes ?? DBNull.Value);

                await using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync()) return Results.Problem("Insert failed.", statusCode: 500);

                var dto = new
                {
                    entryId = r.GetGuid(0),
                    listId = r.GetGuid(1),
                    name = r.GetString(2),
                    phone = r.GetString(3),
                    note = r.GetString(4),
                    numPeople = r.IsDBNull(5) ? (int?)null : r.GetInt32(5),
                    startTime = r.IsDBNull(6) ? null : r.GetString(6),
                    endTime = r.IsDBNull(7) ? null : r.GetString(7),
                    minutes = r.IsDBNull(8) ? (int?)null : r.GetInt32(8),
                    arrived = !r.IsDBNull(9) && r.GetBoolean(9)
                };
                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/lists/{listId:guid}/entries:\n" + ex);
                return Results.Problem($"POST /api/lists/{{listId:guid}}/entries failed: {ex.Message}", statusCode: 500);
            }
        });

        // PATCH /api/lists/{listId}/entries/{entryId}
        app.MapPatch("/api/lists/{listId:guid}/entries/{entryId:guid}", async (Guid listId, Guid entryId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try { 
            var body = await req.ReadFromJsonAsync<JsonElement>();
            if (body.ValueKind != JsonValueKind.Object)
                return Results.BadRequest(new { error = "Invalid JSON." });

            // Fields are optional; only update those provided
            string? name = body.TryGetProperty("name", out var v1) ? v1.GetString() : null;
            string? phone = body.TryGetProperty("phone", out var v2) ? v2.GetString() : null;
            string? note = body.TryGetProperty("note", out var v3) ? v3.GetString() : null;
            int? numPeople = body.TryGetProperty("numPeople", out var v4) && v4.ValueKind != JsonValueKind.Null ? v4.GetInt32() : (int?)null;
            string? start = body.TryGetProperty("startTime", out var v5) ? v5.GetString() : null;
            string? end = body.TryGetProperty("endTime", out var v6) ? v6.GetString() : null;
            int? minutes = body.TryGetProperty("minutes", out var v7) && v7.ValueKind != JsonValueKind.Null ? v7.GetInt32() : (int?)null;
            bool? arrived = body.TryGetProperty("arrived", out var v8) && v8.ValueKind != JsonValueKind.Null ? v8.GetBoolean() : (bool?)null;

                const string sql = @"
  UPDATE list_entries
  SET
    name       = COALESCE(@name, name),
    phone      = COALESCE(@phone, phone),
    note       = COALESCE(@note, note),
    num_people = COALESCE(@num_people, num_people),
    start_time = COALESCE(NULLIF(@start::text, '')::time, start_time),
    end_time   = COALESCE(NULLIF(@end::text,   '')::time, end_time),
    minutes    = COALESCE(@minutes, minutes),
    arrived    = COALESCE(@arrived, arrived)
  WHERE entry_id = @entry_id AND list_id = @list_id
  RETURNING entry_id, list_id, name, phone, note,
            num_people,
            to_char(start_time, 'HH24:MI') as start_time,
            to_char(end_time,   'HH24:MI') as end_time,
            minutes,
            arrived;
";

                await using var cmd = db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("entry_id", entryId);
            cmd.Parameters.AddWithValue("list_id", listId);
            cmd.Parameters.AddWithValue("name", (object?)name ?? DBNull.Value);
            cmd.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
            cmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);
            cmd.Parameters.AddWithValue("num_people", (object?)numPeople ?? DBNull.Value);
            cmd.Parameters.AddWithValue("start", (object?)start ?? DBNull.Value);
            cmd.Parameters.AddWithValue("end", (object?)end ?? DBNull.Value);
            cmd.Parameters.AddWithValue("minutes", (object?)minutes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("arrived", (object?)arrived ?? DBNull.Value);

            await using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return Results.NotFound(new { error = "Entry not found." });

            var dto = new
            {
                entryId = r.GetGuid(0),
                listId = r.GetGuid(1),
                name = r.GetString(2),
                phone = r.GetString(3),
                note = r.GetString(4),
                numPeople = r.IsDBNull(5) ? (int?)null : r.GetInt32(5),
                startTime = r.IsDBNull(6) ? null : r.GetString(6),
                endTime = r.IsDBNull(7) ? null : r.GetString(7),
                minutes = r.IsDBNull(8) ? (int?)null : r.GetInt32(8),
                arrived = !r.IsDBNull(9) && r.GetBoolean(9)
            };
            return Results.Json(dto, jsonOptionsCamel);
        }
        catch (Exception ex)
            {
            Console.Error.WriteLine("Error in PATCH /api/lists/{listId:guid}/entries/{entryId:guid}:\n" + ex);
            return Results.Problem($"PATCH /api/lists/{{listId:guid}}/entries/{{entryId:guid}} failed: {ex.Message}", statusCode: 500);
        }
    });

        // DELETE /api/lists/{listId}/entries/{entryId}
        app.MapDelete("/api/lists/{listId:guid}/entries/{entryId:guid}", async (Guid listId, Guid entryId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"DELETE FROM list_entries WHERE list_id = @lid AND entry_id = @eid;";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("lid", listId);
                cmd.Parameters.AddWithValue("eid", entryId);
                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows == 0) return Results.NotFound(new { error = "Entry not found." });
                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/lists/{listId:guid}/entries/{entryId:guid}:\n" + ex);
                return Results.Problem($"DELETE /api/lists/{{listId:guid}}/entries/{{entryId:guid}} failed: {ex.Message}", statusCode: 500);
            }
        });

      //  // GET /api/stations/{stationId}/lists
      //  app.MapGet("/api/stations/{stationId:guid}/lists", async (Guid stationId, NpgsqlDataSource db) =>
      //  {
      //      try
      //      {
      //          const string sql = @"
      //select l.list_id, l.title, l.list_type, l.created_at
      //from station_lists sl
      //join lists l on l.list_id = sl.list_id
      //where sl.station_id = @station_id
      //order by l.created_at desc";
      //          var list = new List<ListDto>();
      //          await using var cmd = db.CreateCommand(sql);
      //          cmd.Parameters.AddWithValue("@station_id", stationId);
      //          await using var reader = await cmd.ExecuteReaderAsync();
      //          while (await reader.ReadAsync())
      //          {
      //              list.Add(new ListDto
      //              {
      //                  ListId = reader.GetGuid(0),
      //                  Title = reader.GetString(1),
      //                  ListType = reader.GetString(2)
      //              });
      //          }
      //          return Results.Json(list, jsonOptionsCamel);
      //      }
      //      catch (Exception ex)
      //      {
      //          Console.Error.WriteLine("Error in GET /api/stations/{stationId:guid}/lists:\n" + ex);
      //          return Results.Problem($"GET /api/stations/{{stationId:guid}}/lists failed: {ex.Message}", statusCode: 500);
      //      }
      //  });


    }
}