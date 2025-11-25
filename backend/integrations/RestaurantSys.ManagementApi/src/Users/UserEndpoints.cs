using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {

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
                list.Add(new UserDto {
                    UserId = reader.GetGuid(0),
                    Name = reader.GetString(1),
                    Role = reader.GetString(2)
                });
            }

            return Results.Json(
                list,
                new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
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

            var dto = new UserDto {
                UserId = reader.GetGuid(0),
                Name = reader.GetString(1),
                Role = reader.GetString(2)
            };

            return Results.Json(
                dto,
                new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
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

                var ok = VerifyPasscode(body.Passcode, storedHash);
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
                Console.Error.WriteLine(ex);  /* this prints the REAL reason */

                return Results.Problem("Login failed due to server error.", statusCode: 500);
            }
        });



    }

    static bool VerifyPasscode(string passcode, string storedHash)
    {
        return BCrypt.Net.BCrypt.Verify(passcode, storedHash);
    }
}