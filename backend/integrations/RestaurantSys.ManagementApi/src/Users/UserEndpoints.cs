using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {
        // ===== existing endpoints (keep) =====

        app.MapGet("/api/auth/users", async (NpgsqlDataSource db) =>
        {
            const string sql = @"
        select user_id, name, role
        from app_users
        order by name;
    ";

            var list = new List<UserDto>();

            await using var cmd = db.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new UserDto
                {
                    UserId = reader.GetGuid(0),
                    Name = reader.GetString(1),
                    Role = reader.GetString(2)
                });
            }

            return Results.Json(
                list,
                new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                }
            );
        });

        app.MapPost("/api/auth/users", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            var body = await req.ReadFromJsonAsync<CreateUserRequest>();
            if (body is null)
                return Results.BadRequest(new { error = "Invalid JSON." });

            var name = (body.Name ?? string.Empty).Trim();
            if (name.Length == 0)
                return Results.BadRequest(new { error = "Name is required." });

            var role = (body.Role ?? string.Empty).Trim().ToLowerInvariant();
            if (role != "user" && role != "admin")
                return Results.BadRequest(new { error = "Role must be 'user' or 'admin'." });

            var passcode = (body.Passcode ?? string.Empty).Trim();
            if (passcode.Length < 4 || passcode.Length > 12)
                return Results.BadRequest(new { error = "Passcode must be 4–12 characters." });

            var hash = BCrypt.Net.BCrypt.HashPassword(passcode);

            const string sql = @"
        insert into app_users (name, role, passcode_hash)
        values (@name, @role, @hash)
        returning user_id, name, role;
    ";

            await using var cmd = db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("name", name);
            cmd.Parameters.AddWithValue("role", role);
            cmd.Parameters.AddWithValue("hash", hash);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return Results.Problem("Failed to create user.", statusCode: 500);

            var dto = new UserDto
            {
                UserId = reader.GetGuid(0),
                Name = reader.GetString(1),
                Role = reader.GetString(2)
            };

            return Results.Json(
                dto,
                new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                }
            );
        });

        app.MapPost("/api/auth/login", async (LoginRequest body, NpgsqlDataSource db) =>
        {
            try
            {
                if (body is null || body.UserId == Guid.Empty)
                {
                    return Results.BadRequest(new { error = "UserId is required." });
                }

                if (string.IsNullOrWhiteSpace(body.Passcode))
                {
                    return Results.BadRequest(new { error = "Passcode is required." });
                }

                const string sql = @"
            select passcode_hash
            from app_users
            where user_id = @user_id
            limit 1;
        ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("user_id", body.UserId);

                var dbHashObj = await cmd.ExecuteScalarAsync();
                var storedHash = dbHashObj as string;

                if (storedHash is null)
                {
                    return Results.Json(
                        new { success = false, error = "Invalid user or passcode." },
                        statusCode: StatusCodes.Status401Unauthorized
                    );
                }

                var ok = BCrypt.Net.BCrypt.Verify(body.Passcode, storedHash);
                if (!ok)
                {
                    return Results.Json(
                        new { success = false, error = "Invalid user or passcode." },
                        statusCode: StatusCodes.Status401Unauthorized
                    );
                }

                return Results.Ok(new { success = true });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/auth/login:");
                Console.Error.WriteLine(ex);

                return Results.Problem("Login failed due to server error.", statusCode: 500);
            }
        });

        // ===== NEW: POST /api/auth/lookup-code =====
        // Body: { code: "1234" }
        // Returns: { userId, name, role } or 404
        app.MapPost("/api/auth/lookup-code", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind == JsonValueKind.Undefined || body.ValueKind == JsonValueKind.Null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                string code = body.TryGetProperty("code", out var p) && p.ValueKind == JsonValueKind.String
                    ? (p.GetString() ?? string.Empty).Trim()
                    : string.Empty;

                if (!System.Text.RegularExpressions.Regex.IsMatch(code, @"^\d{4}$"))
                {
                    return Results.BadRequest(new { error = "Code must be a 4-digit number." });
                }

                const string sql = @"
            select user_id, name, role
            from app_users
            where login_code = @code
            limit 1;
        ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("code", code);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound(new { error = "No user found for this code." });
                }

                var user = new
                {
                    UserId = reader.GetGuid(0),
                    Name = reader.GetString(1),
                    Role = reader.GetString(2)
                };

                return Results.Json(
                    user,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/auth/lookup-code:");
                Console.Error.WriteLine(ex);

                return Results.Problem("Lookup code failed.", statusCode: 500);
            }
        });

        // ===== NEW: POST /api/auth/rotate-code =====
        // Body: { userId: "guid" }
        // Generates a new unique 4-digit login_code for that user.
        app.MapPost("/api/auth/rotate-code", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind == JsonValueKind.Undefined || body.ValueKind == JsonValueKind.Null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                if (!body.TryGetProperty("userId", out var p) || p.ValueKind != JsonValueKind.String)
                    return Results.BadRequest(new { error = "userId is required." });

                if (!Guid.TryParse(p.GetString(), out var userId) || userId == Guid.Empty)
                    return Results.BadRequest(new { error = "Invalid userId." });

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                // Ensure user exists
                const string checkUserSql = @"select 1 from app_users where user_id = @user_id;";
                await using (var checkCmd = new NpgsqlCommand(checkUserSql, conn, tx))
                {
                    checkCmd.Parameters.AddWithValue("user_id", userId);
                    var exists = await checkCmd.ExecuteScalarAsync();
                    if (exists is null)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "User not found." });
                    }
                }

                // Generate unique 4-digit code
                string newCode = await GenerateUniqueLoginCodeAsync(conn, tx);

                const string updateSql = @"update app_users set login_code = @code where user_id = @user_id;";
                await using (var updateCmd = new NpgsqlCommand(updateSql, conn, tx))
                {
                    updateCmd.Parameters.AddWithValue("code", newCode);
                    updateCmd.Parameters.AddWithValue("user_id", userId);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();

                return Results.Json(
                    new { loginCode = newCode },
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/auth/rotate-code:");
                Console.Error.WriteLine(ex);

                return Results.Problem("Rotate code failed.", statusCode: 500);
            }
        });
    }

    // helper for rotate-code (and can be reused by worker creation)
    static async Task<string> GenerateUniqueLoginCodeAsync(NpgsqlConnection conn, NpgsqlTransaction tx)
    {
        var rnd = new Random();

        for (int attempt = 0; attempt < 20; attempt++)
        {
            var code = rnd.Next(0, 10000).ToString("D4");

            const string checkSql = @"select 1 from app_users where login_code = @code limit 1;";
            await using var checkCmd = new NpgsqlCommand(checkSql, conn, tx);
            checkCmd.Parameters.AddWithValue("code", code);

            var exists = await checkCmd.ExecuteScalarAsync();
            if (exists is null)
            {
                return code;
            }
        }

        // extreme fallback
        return "0000";
    }
    static bool VerifyPasscode(string passcode, string storedHash)
    {
        return BCrypt.Net.BCrypt.Verify(passcode, storedHash);
    }
}