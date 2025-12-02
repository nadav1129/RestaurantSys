using System.Text.Json;
using Npgsql;

public static class WorkerEndpoints
{
    public static void MapWorkerEndpoints(this WebApplication app)
    {
        /* GET /api/workers */
        app.MapGet("/api/workers", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select worker_id,
                           first_name,
                           last_name,
                           personal_id,
                           email,
                           phone,
                           position,
                           salary_cents,
                           created_at
                      from workers
                     order by created_at;";

                var list = new List<object>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new
                    {
                        WorkerId = reader.GetGuid(0),
                        FirstName = reader.GetString(1),
                        LastName = reader.GetString(2),
                        PersonalId = reader.IsDBNull(3) ? null : reader.GetString(3),
                        Email = reader.IsDBNull(4) ? null : reader.GetString(4),
                        Phone = reader.IsDBNull(5) ? null : reader.GetString(5),
                        Position = reader.GetString(6),
                        SalaryCents = reader.IsDBNull(7) ? (int?)null : reader.GetInt32(7),
                        CreatedAt = reader.GetDateTime(8)
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
                Console.Error.WriteLine("Error in GET /api/workers:\n" + ex);
                return Results.Problem("GET /api/workers failed", statusCode: 500);
            }
        });

        /* GET /api/workers/{workerId} */
        app.MapGet("/api/workers/{workerId:guid}", async (Guid workerId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select worker_id,
                           first_name,
                           last_name,
                           personal_id,
                           email,
                           phone,
                           position,
                           salary_cents,
                           created_at
                      from workers
                     where worker_id = @worker_id;";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("worker_id", workerId);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound(new { error = "Worker not found." });
                }

                var worker = new
                {
                    WorkerId = reader.GetGuid(0),
                    FirstName = reader.GetString(1),
                    LastName = reader.GetString(2),
                    PersonalId = reader.IsDBNull(3) ? null : reader.GetString(3),
                    Email = reader.IsDBNull(4) ? null : reader.GetString(4),
                    Phone = reader.IsDBNull(5) ? null : reader.GetString(5),
                    Position = reader.GetString(6),
                    SalaryCents = reader.IsDBNull(7) ? (int?)null : reader.GetInt32(7),
                    CreatedAt = reader.GetDateTime(8)
                };

                return Results.Json(
                    worker,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/workers/{workerId}:\n" + ex);
                return Results.Problem("GET /api/workers/{workerId} failed", statusCode: 500);
            }
        });

        /* POST /api/workers */
        app.MapPost("/api/workers", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind == JsonValueKind.Undefined || body.ValueKind == JsonValueKind.Null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                string GetString(JsonElement src, string name)
                {
                    return src.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String
                        ? p.GetString() ?? string.Empty
                        : string.Empty;
                }

                string? GetOptionalString(JsonElement src, string name)
                {
                    if (!src.TryGetProperty(name, out var p)) return null;
                    if (p.ValueKind == JsonValueKind.Null) return null;
                    if (p.ValueKind != JsonValueKind.String) return null;
                    var s = p.GetString();
                    return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
                }

                int? GetOptionalInt(JsonElement src, string name)
                {
                    if (!src.TryGetProperty(name, out var p)) return null;
                    if (p.ValueKind == JsonValueKind.Null) return null;
                    if (p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var i))
                        return i;
                    return null;
                }

                var firstName = GetString(body, "firstName").Trim();
                var lastName = GetString(body, "lastName").Trim();
                var position = GetString(body, "position").Trim();

                if (firstName.Length == 0)
                    return Results.BadRequest(new { error = "First name is required." });
                if (lastName.Length == 0)
                    return Results.BadRequest(new { error = "Last name is required." });
                if (position.Length == 0)
                    return Results.BadRequest(new { error = "Position is required." });

                var personalId = GetOptionalString(body, "personalId");
                var email = GetOptionalString(body, "email");
                var phone = GetOptionalString(body, "phone");
                var salaryCents = GetOptionalInt(body, "salaryCents");

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                /* 1) Insert worker */
                var rnd = new Random();
                var staffCode = rnd.Next(0, 10000).ToString("D4");

                const string insertWorkerSql = @"
    insert into workers (
        first_name,
        last_name,
        personal_id,
        email,
        phone,
        position,
        salary_cents,
        staff_code
    )
    values (
        @first_name,
        @last_name,
        @personal_id,
        @email,
        @phone,
        @position,
        @salary_cents,
        @staff_code
    )
    returning worker_id,
              first_name,
              last_name,
              personal_id,
              email,
              phone,
              position,
              salary_cents,
              created_at;
";





                await using var cmd = new NpgsqlCommand(insertWorkerSql, conn, tx);
                cmd.Parameters.AddWithValue("first_name", firstName);
                cmd.Parameters.AddWithValue("last_name", lastName);
                cmd.Parameters.AddWithValue("personal_id", (object?)personalId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("email", (object?)email ?? DBNull.Value);
                cmd.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
                cmd.Parameters.AddWithValue("position", position);
                cmd.Parameters.AddWithValue("salary_cents", (object?)salaryCents ?? DBNull.Value);
                cmd.Parameters.AddWithValue("staff_code", staffCode);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    await tx.RollbackAsync();
                    return Results.Problem("Failed to create worker.", statusCode: 500);
                }

                var worker = new
                {
                    WorkerId = reader.GetGuid(0),
                    FirstName = reader.GetString(1),
                    LastName = reader.GetString(2),
                    PersonalId = reader.IsDBNull(3) ? null : reader.GetString(3),
                    Email = reader.IsDBNull(4) ? null : reader.GetString(4),
                    Phone = reader.IsDBNull(5) ? null : reader.GetString(5),
                    Position = reader.GetString(6),
                    SalaryCents = reader.IsDBNull(7) ? (int?)null : reader.GetInt32(7),
                    CreatedAt = reader.GetDateTime(8)
                };
                await reader.DisposeAsync();
                await tx.CommitAsync();

                var response = new
                {
                    worker,
                    loginCode = staffCode
                };

                return Results.Json(
                    response,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/workers:\n" + ex);
                return Results.Problem("POST /api/workers failed", statusCode: 500);
            }
        });

        /* DELETE /api/workers/{workerId} */
        app.MapDelete("/api/workers/{workerId:guid}", async (Guid workerId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"delete from workers where worker_id = @worker_id;";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("worker_id", workerId);

                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows == 0)
                {
                    return Results.NotFound(new { error = "Worker not found." });
                }

                // If app_users.worker_id has ON DELETE CASCADE, related logins are removed automatically.
                return Results.NoContent();
            }
            catch (PostgresException pgex) when (pgex.SqlState == "23503")
            {
                // FK violation (worker referenced in shifts/orders)
                Console.Error.WriteLine("FK violation deleting worker:\n" + pgex);
                return Results.BadRequest(new { error = "Cannot delete worker because it is in use." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in DELETE /api/workers/{workerId}:\n" + ex);
                return Results.Problem("DELETE /api/workers/{workerId} failed", statusCode: 500);
            }
        });
    }
}
