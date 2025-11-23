using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class IngredientsEndpoints
{
    public static void MapIngredientsEndpoints(this WebApplication app)
    {
        // ===== INGREDIENTS =====
        // GET /api/ingredients
        app.MapGet("/api/ingredients", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
            select ingredient_id, btrim(name) as name
            from ingredients
            order by name nulls last;
        ";

                var list = new List<(Guid IngredientId, string Name)>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var id = reader.GetGuid(0);
                    var name = reader.IsDBNull(1) ? "" : reader.GetString(1);
                    list.Add((id, name));
                }

                // Shape the payload explicitly in camelCase
                var payload = list.Select(x => new
                {
                    ingredientId = x.IngredientId,
                    name = x.Name
                });

                return Results.Json(payload); // content-type: application/json
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/ingredients:\n" + ex);
                return Results.Problem($"GET /api/ingredients failed: {ex.Message}", statusCode: 500);
            }
        });

        // POST /api/ingredients
        app.MapPost("/api/ingredients", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await System.Text.Json.JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind == System.Text.Json.JsonValueKind.Undefined ||
                    body.ValueKind == System.Text.Json.JsonValueKind.Null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var name = body.TryGetProperty("name", out var n) ? n.GetString()?.Trim() ?? "" : "";
                if (string.IsNullOrWhiteSpace(name))
                    return Results.BadRequest(new { error = "Name is required." });

                /* Optional field from UI, ignore if backend doesn’t support it yet */
                var baseUnit = body.TryGetProperty("baseUnit", out var b) ? b.GetString() ?? "" : "";

                // Check for duplicate (case-insensitive)
                const string checkSql = "select 1 from public.ingredients where lower(name) = lower($1) limit 1;";
                await using (var checkCmd = db.CreateCommand(checkSql))
                {
                    checkCmd.Parameters.AddWithValue(name);
                    var exists = await checkCmd.ExecuteScalarAsync();
                    if (exists is not null)
                        return Results.BadRequest(new { error = "Ingredient already exists." });
                }

                // Insert new ingredient
                var id = Guid.NewGuid();
                const string insSql = @"
            insert into public.ingredients (ingredient_id, name)
            values ($1, $2);
        ";
                await using (var insCmd = db.CreateCommand(insSql))
                {
                    insCmd.Parameters.AddWithValue(id);
                    insCmd.Parameters.AddWithValue(name);
                    await insCmd.ExecuteNonQueryAsync();
                }

                return Results.Json(new { ingredientId = id, name, baseUnit });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/ingredients:\n" + ex);
                return Results.Problem($"POST /api/ingredients failed: {ex.Message}", statusCode: 500);
            }
        });

        // DELETE /api/ingredients/{id}
        app.MapDelete("/api/ingredients/{id:guid}", async (Guid id, NpgsqlDataSource db) =>
        {
            // 0) Does it exist?
            const string checkIng = "select name from public.ingredients where ingredient_id = $1;";
            string? ingName = null;
            await using (var chk = db.CreateCommand(checkIng))
            {
                chk.Parameters.AddWithValue(id);
                var o = await chk.ExecuteScalarAsync();
                if (o is null) return Results.NotFound(new { error = "Ingredient not found." });
                ingName = (string)o;
            }

            // 1) Is it referenced by any product?
            const string usageCountSql = "select count(*) from public.product_ingredients where ingredient_id = $1;";
            int usageCount;
            await using (var ccmd = db.CreateCommand(usageCountSql))
            {
                ccmd.Parameters.AddWithValue(id);
                usageCount = Convert.ToInt32(await ccmd.ExecuteScalarAsync());
            }

            if (usageCount > 0)
            {
                // Optional: return up to 5 sample product names to help the user
                const string sampleSql = @"
            select p.name
            from public.product_ingredients pi
            join public.products p on p.product_id = pi.product_id
            where pi.ingredient_id = $1
            order by lower(p.name)
            limit 5;";
                var samples = new List<string>();
                await using (var scmd = db.CreateCommand(sampleSql))
                {
                    scmd.Parameters.AddWithValue(id);
                    await using var r = await scmd.ExecuteReaderAsync();
                    while (await r.ReadAsync()) samples.Add(r.GetString(0));
                }

                return Results.Json(new
                {
                    error = "Ingredient is in use and cannot be deleted.",
                    ingredientId = id,
                    ingredientName = ingName,
                    inUseCount = usageCount,
                    sampleProducts = samples
                }, statusCode: StatusCodes.Status409Conflict);
            }

            // 2) Safe to delete
            const string delSql = "delete from public.ingredients where ingredient_id = $1;";
            await using (var del = db.CreateCommand(delSql))
            {
                del.Parameters.AddWithValue(id);
                await del.ExecuteNonQueryAsync();
            }

            return Results.NoContent();
        });
    }
}
