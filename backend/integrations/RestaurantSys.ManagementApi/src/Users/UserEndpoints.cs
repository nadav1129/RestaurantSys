using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace RestaurantSys.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {


        // ===== POST /api/auth/claim-staff-code =====
        // Body: { staffCode: "1234", passcode: "567890" }
        // Use-case: first-time login for a worker using the 4-digit staff code.
        // It:
        //   1. Finds the worker with the given staff_code.
        //   2. Ensures they don't already have an app_user.
        //   3. Creates app_user with hashed passcode.
        //   4. Clears staff_code so it can't be reused.
        app.MapPost("/api/auth/claim-staff-code", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                {
                    return Results.BadRequest(new { error = "Invalid JSON." });
                }

                var staffCode = body.TryGetProperty("staffCode", out var sc) && sc.ValueKind == JsonValueKind.String
                    ? sc.GetString()!.Trim()
                    : string.Empty;

                var passcode = body.TryGetProperty("passcode", out var pc) && pc.ValueKind == JsonValueKind.String
                    ? pc.GetString()!.Trim()
                    : string.Empty;

                Console.WriteLine($"[claim-staff-code] staffCode='{staffCode}', passcode length={passcode.Length}");

                /* staffCode: exactly 4 digits, but kept as TEXT */
                if (!Regex.IsMatch(staffCode, @"^\d{4}$"))
                {
                    return Results.BadRequest(new { error = "Invalid staff code." });
                }

                /* passcode: 4–12 digits */
                if (!Regex.IsMatch(passcode, @"^\d{4,12}$"))
                {
                    return Results.BadRequest(new { error = "Passcode must be 4–12 digits." });
                }

                // 1) Find worker by staff_code (TEXT)
                Guid? workerId = null;
                string workerName = "(no name)";

                const string findWorkerSql = @"
            select worker_id, first_name, last_name
              from workers
             where staff_code = @staff_code
             limit 1;
        ";

                await using (var cmd = db.CreateCommand(findWorkerSql))
                {
                    // IMPORTANT: staff_code is TEXT -> pass string
                    cmd.Parameters.AddWithValue("staff_code", staffCode);

                    await using var reader = await cmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        workerId = reader.GetGuid(0);
                        var firstName = reader.IsDBNull(1) ? "" : reader.GetString(1);
                        var lastName = reader.IsDBNull(2) ? "" : reader.GetString(2);
                        workerName = string.Join(" ", new[] { firstName, lastName }.Where(s => !string.IsNullOrWhiteSpace(s)));
                        if (string.IsNullOrWhiteSpace(workerName))
                            workerName = "(no name)";
                    }
                }

                if (workerId is null)
                {
                    Console.WriteLine($"[claim-staff-code] No worker found for staff_code='{staffCode}'.");
                    return Results.BadRequest(new { error = "Staff code not found or already used." });
                }

                // 2) Ensure this worker does not already have an app_user
                const string checkUserSql = @"
            select count(*) 
              from app_users
             where worker_id = @worker_id;
        ";

                long existingUsers;
                await using (var cmd = db.CreateCommand(checkUserSql))
                {
                    cmd.Parameters.AddWithValue("worker_id", workerId.Value);
                    var result = await cmd.ExecuteScalarAsync();
                    existingUsers = (result is long l) ? l : Convert.ToInt64(result);
                }

                if (existingUsers > 0)
                {
                    return Results.BadRequest(new { error = "This staff code has already been claimed." });
                }

                // 3) Create app_user with hashed passcode
                var hash = BCrypt.Net.BCrypt.HashPassword(passcode);

                const string insertUserSql = @"
            insert into app_users (worker_id, role, passcode_hash, created_at)
            values (@worker_id, @role, @passcode_hash, now())
            returning user_id;
        ";

                Guid userId;
                await using (var cmd = db.CreateCommand(insertUserSql))
                {
                    cmd.Parameters.AddWithValue("worker_id", workerId.Value);
                    cmd.Parameters.AddWithValue("role", "user"); /* or whatever role */
                    cmd.Parameters.AddWithValue("passcode_hash", hash);

                    var obj = await cmd.ExecuteScalarAsync();
                    if (obj is Guid g)
                        userId = g;
                    else
                        return Results.Problem("Failed to create user.", statusCode: 500);
                }

                // 4) Clear staff_code so it can't be reused
                const string clearStaffCodeSql = @"
            update workers
               set staff_code = null
             where worker_id = @worker_id;
        ";

                await using (var cmd = db.CreateCommand(clearStaffCodeSql))
                {
                    cmd.Parameters.AddWithValue("worker_id", workerId.Value);
                    await cmd.ExecuteNonQueryAsync();
                }

                return Results.Json(
                    new
                    {
                        userId,
                        name = workerName,
                        message = "User created. You can now log in with your personal code."
                    },
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/auth/claim-staff-code:");
                Console.Error.WriteLine(ex);
                return Results.Problem("Claim staff code failed.", statusCode: 500);
            }
        });

        // ===== POST /api/auth/lookup-code =====
        // Body: { staffCode: "1234" }
        // Use-case: Step 1 - verify staff code exists and is not already claimed.
        app.MapPost("/api/auth/lookup-code", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                {
                    return Results.BadRequest(new { error = "Invalid JSON." });
                }

                var staffCode = body.TryGetProperty("staffCode", out var sc) && sc.ValueKind == JsonValueKind.String
                    ? sc.GetString()!.Trim()
                    : string.Empty;

                Console.WriteLine($"[lookup-code] staffCode='{staffCode}'");

                // staffCode: exactly 4 digits, but stored as TEXT in DB
                if (!Regex.IsMatch(staffCode, @"^\d{4}$"))
                {
                    return Results.BadRequest(new { error = "Invalid staff code format." });
                }

                // Find worker by staff_code (TEXT) and check if they already have an app_user
                const string sql = @"
                    select w.worker_id,
                           coalesce(nullif(trim(w.first_name || ' ' || w.last_name), ''), '(no name)') as full_name,
                           count(au.user_id) as user_count
                      from workers w
                      left join app_users au on au.worker_id = w.worker_id
                     where w.staff_code = @staff_code
                     group by w.worker_id, full_name
                     limit 1;
                ";

                Guid workerId;
                string fullName;
                long userCount;

                await using (var cmd = db.CreateCommand(sql))
                {
                    cmd.Parameters.AddWithValue("staff_code", staffCode); // TEXT column → string param

                    await using var reader = await cmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                    {
                        Console.WriteLine($"[lookup-code] No worker found for staff_code='{staffCode}'.");
                        return Results.BadRequest(new { error = "Staff code not found." });
                    }

                    workerId = reader.GetGuid(0);
                    fullName = reader.GetString(1);
                    userCount = reader.GetInt64(2);
                }

                if (userCount > 0)
                {
                    return Results.BadRequest(new { error = "This staff code has already been claimed." });
                }

                // Match what LoginPage.tsx expects: { userId, name, message? }
                return Results.Json(
                    new
                    {
                        userId = workerId,
                        name = fullName,
                        message = "Staff code valid. Choose your personal PIN."
                    },
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
                return Results.Problem("Lookup staff code failed.", statusCode: 500);
            }
        });

        // ===== existing /api/auth/claim-staff-code here =====
        // (keep your current, TEXT-based version)
        // app.MapPost("/api/auth/claim-staff-code", ...);

        // ===== GET /api/auth/users =====
        // Returns all app_users with worker-based display name.
        // GET /api/auth/users
        app.MapGet("/api/auth/users", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
            select
                au.user_id,
                au.worker_id,
                coalesce(nullif(btrim(w.first_name || ' ' || w.last_name), ''), '(no name)') as full_name,
                au.role
            from app_users au
            join workers w on w.worker_id = au.worker_id
            order by full_name;";

                var list = new List<object>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    // user_id and worker_id must be non-null GUIDs
                    list.Add(new
                    {
                        userId = reader.GetGuid(0),
                        workerId = reader.GetGuid(1),
                        name = reader.GetString(2),
                        role = reader.IsDBNull(3) ? null : reader.GetString(3)  /* "user" | "admin" */
                    });
                }

                return Results.Json(list, new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
                });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/auth/users:\n" + ex);
                return Results.Problem("Failed to load users.", statusCode: 500);
            }
        });

        // ===== POST /api/auth/users =====
        // Body: { workerId, role, passcode }
        // Creates an app_user for an existing worker.
        app.MapPost("/api/auth/users", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await req.ReadFromJsonAsync<CreateUserRequest>();
                if (body is null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                if (body.WorkerId == Guid.Empty)
                    return Results.BadRequest(new { error = "workerId is required." });

                var role = (body.Role ?? string.Empty).Trim().ToLowerInvariant();
                if (role != "user" && role != "admin")
                    return Results.BadRequest(new { error = "Role must be 'user' or 'admin'." });

                var passcode = (body.Passcode ?? string.Empty).Trim();
                if (passcode.Length < 4 || passcode.Length > 12)
                    return Results.BadRequest(new { error = "Passcode must be 4–12 characters." });

                var hash = BCrypt.Net.BCrypt.HashPassword(passcode);

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                // Ensure worker exists
                const string workerSql = @"
                    select first_name, last_name
                      from workers
                     where worker_id = @worker_id
                     limit 1;
                ";
                string firstName, lastName;

                await using (var wcmd = new NpgsqlCommand(workerSql, conn, tx))
                {
                    wcmd.Parameters.AddWithValue("worker_id", body.WorkerId);
                    await using var wreader = await wcmd.ExecuteReaderAsync();
                    if (!await wreader.ReadAsync())
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = "Worker not found." });
                    }

                    firstName = wreader.GetString(0);
                    lastName = wreader.GetString(1);
                }

                // Ensure no existing user for this worker
                const string checkSql = @"select 1 from app_users where worker_id = @worker_id limit 1;";
                await using (var ccmd = new NpgsqlCommand(checkSql, conn, tx))
                {
                    ccmd.Parameters.AddWithValue("worker_id", body.WorkerId);
                    var exists = await ccmd.ExecuteScalarAsync();
                    if (exists is not null)
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = "This worker already has a user." });
                    }
                }

                // Insert app_user
                const string insertSql = @"
                    insert into app_users (worker_id, role, passcode_hash)
                    values (@worker_id, @role, @hash)
                    returning user_id;
                ";

                Guid userId;
                await using (var cmd = new NpgsqlCommand(insertSql, conn, tx))
                {
                    cmd.Parameters.AddWithValue("worker_id", body.WorkerId);
                    cmd.Parameters.AddWithValue("role", role);
                    cmd.Parameters.AddWithValue("hash", hash);

                    var obj = await cmd.ExecuteScalarAsync();
                    if (obj is not Guid g)
                    {
                        await tx.RollbackAsync();
                        return Results.Problem("Failed to create user.", statusCode: 500);
                    }

                    userId = g;
                }

                await tx.CommitAsync();

                var dto = new UserDto
                {
                    UserId = userId,
                    Name = $"{firstName} {lastName}",
                    Role = role
                };

                return Results.Json(
                    dto,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/auth/users:");
                Console.Error.WriteLine(ex);

                return Results.Problem("Creating new user failed.", statusCode: 500);
            }
        });

        // ===== POST /api/auth/login =====
        // Body: { userId, passcode }
        app.MapPost("/api/auth/login", async (LoginRequest body, NpgsqlDataSource db) =>
        {
            try
            {
                if (body is null || body.UserId == Guid.Empty)
                    return Results.BadRequest(new { error = "UserId is required." });

                if (string.IsNullOrWhiteSpace(body.Passcode))
                    return Results.BadRequest(new { error = "Passcode is required." });

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

        // ===== NOTE about lookup-code / rotate-code =====
        //
        // Your current schema for app_users does NOT have a 'login_code' column.
        // The previous implementations of:
        //   - POST /api/auth/lookup-code
        //   - POST /api/auth/rotate-code
        // and the helper GenerateUniqueLoginCodeAsync
        // all depend on app_users.login_code.
        //
        // For now, they should be DISABLED or removed.
        // If you later decide to add:
        //   ALTER TABLE app_users ADD COLUMN login_code text UNIQUE;
        // we can reintroduce those endpoints using that column.
    }
}
