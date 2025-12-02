using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Text.Json;

namespace RestaurantSys.ManagementApi.Management.Menu;

public static class MenusEndpoints
{
    public static void MapMenusEndpoints(this WebApplication app)
    {
        // ===== MENUS =====
        // GET /api/menus
        app.MapGet("/api/menus", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = "select menu_num, name from public.menus order by menu_num;";
                var list = new List<MenuDto>();
                await using var cmd = db.CreateCommand(sql);
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    list.Add(new MenuDto { MenuNum = r.GetInt32(0), Name = r.GetString(1) });
                return Results.Json(list);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/menus:");
                Console.Error.WriteLine(ex);
                return Results.Problem($"GET /api/menus failed: {ex.Message}", statusCode: 500);
            }
        });

        // POST /api/menus
        app.MapPost("/api/menus", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                string? requestedName = null;
                if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("name", out var nameProp))
                    requestedName = (nameProp.GetString() ?? "").Trim();

                // 1) Insert into menus -> returns new counter (n+1)
                const string insMenu = @"insert into public.menus(name) values($1) returning menu_num, name;";
                int newMenuNum; string menuName;
                await using (var cmd = db.CreateCommand(insMenu))
                {
                    cmd.Parameters.AddWithValue((object?)requestedName ?? DBNull.Value);
                    await using var r = await cmd.ExecuteReaderAsync();
                    await r.ReadAsync();
                    newMenuNum = r.GetInt32(0);
                    menuName = r.GetString(1);
                }

                return Results.Json(new { menuNum = newMenuNum, name = menuName });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/menus:");
                Console.Error.WriteLine(ex);
                return Results.Problem($"POST /api/menus failed: {ex.Message}", statusCode: 500);
            }
        });

        // DELETE /api/menus/{menuNum}
        app.MapDelete("/api/menus/{menuNum:int}", async (int menuNum, NpgsqlDataSource db) =>
        {
            try
            {
                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                // Ensure menu exists 
                await using (var check = new NpgsqlCommand(
                    "select 1 from menus where menu_num = @menu_num limit 1;", conn, tx))
                {
                    check.Parameters.AddWithValue("menu_num", menuNum);
                    var exists = await check.ExecuteScalarAsync();
                    if (exists is null)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Menu not found." });
                    }
                }
                // Delete all nodes that belong to this menu (if you don't already rely on FK CASCADE)
                await using (var delNodes = new NpgsqlCommand(
                    "delete from menu_nodes where menu_num = @menu_num;", conn, tx))
                {
                    delNodes.Parameters.AddWithValue("menu_num", menuNum);
                    await delNodes.ExecuteNonQueryAsync();
                }

                // Delete the menu row itself
                var affected = 0;
                await using (var delMenu = new NpgsqlCommand(
                    "delete from menus where menu_num = @menu_num;", conn, tx))
                {
                    delMenu.Parameters.AddWithValue("menu_num", menuNum);
                    affected = await delMenu.ExecuteNonQueryAsync();
                }

                if (affected == 0)
                {
                    await tx.RollbackAsync();
                    return Results.NotFound(new { error = "Menu not found." });
                }

                await tx.CommitAsync();
                return Results.NoContent();

            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in Delete /api/menus:");
                Console.Error.WriteLine(ex);
                return Results.Problem($"POST /api/menus failed: {ex.Message}", statusCode: 500);
            }
        });

        // PATCH /api/menus/{menuNum}
        app.MapPatch("/api/menus/{menuNum:int}", async (int menuNum, UpdateMenuPayload payload, NpgsqlDataSource db) =>
        {
            try
            {
                var name = (payload?.Name ?? "").Trim();
                if (name.Length == 0) return Results.BadRequest(new { error = "Name is required." });

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                // Optional existence check (or rely on affected row == 0 below)

                const string sql = """
        update menus
        set name = @name
        where menu_num = @menu_num
        returning menu_num, name;
        """;

                int outMenuNum;
                string outName;

                await using (var cmd = new NpgsqlCommand(sql, conn, tx))
                {
                    cmd.Parameters.AddWithValue("name", name);
                    cmd.Parameters.AddWithValue("menu_num", menuNum);

                    // Limit to one row and ensure reader is disposed before COMMIT
                    await using var reader = await cmd.ExecuteReaderAsync(System.Data.CommandBehavior.SingleRow);

                    if (!await reader.ReadAsync())
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Menu not found." });
                    }

                    outMenuNum = reader.GetInt32(0);
                    outName = reader.GetString(1);
                    // reader disposed at the end of this using block
                }

                await tx.CommitAsync();

                return Results.Ok(new { menuNum = outMenuNum, name = outName });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in Patch /api/menus:");
                Console.Error.WriteLine(ex);
                return Results.Problem($"PATCH /api/menus failed: {ex.Message}", statusCode: 500);
            }
        });
    }
}
