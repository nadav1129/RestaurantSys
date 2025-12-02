using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class SpeedMapEndpoints
{
    public static void MapSpeedMapEndpoints(this WebApplication app)
    {
        // ===== SPEED MAP =====
        app.MapGet("/api/speed-map", async (NpgsqlDataSource db) =>
        {
            const string sql = @"
                    select i.ingredient_id,
                           i.name as ingredient_name,
                           sm.bottle_product_id,
                           p.name as bottle_product_name
                    from ingredients i
                    left join speed_map sm on sm.ingredient_id = i.ingredient_id
                    left join products p on p.product_id = sm.bottle_product_id
                    order by i.name;
                ";

            var list = new List<SpeedMapRowDto>();

            await using var cmd = db.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new SpeedMapRowDto
                {
                    IngredientId = reader.GetGuid(0),
                    IngredientName = reader.GetString(1),
                    BottleProductId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                    BottleProductName = reader.IsDBNull(3) ? null : reader.GetString(3)
                });
            }

            return Results.Json(list);
        }); ;

        app.MapPut("/api/speed-map", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            app.MapPut("/api/speed-map", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                var body = await JsonSerializer.DeserializeAsync<List<UpdateSpeedMapRequestRow>>(req.Body);
                if (body is null)
                    return Results.BadRequest("invalid json");

                foreach (var row in body)
                {
                    if (row.BottleProductId is null)
                    {
                        const string delSql = "delete from speed_map where ingredient_id = $1;";
                        await using var delCmd = db.CreateCommand(delSql);
                        delCmd.Parameters.AddWithValue(row.IngredientId);
                        await delCmd.ExecuteNonQueryAsync();
                    }
                    else
                    {
                        const string upSql = @"
                            insert into speed_map (ingredient_id, bottle_product_id)
                            values ($1,$2)
                            on conflict (ingredient_id)
                            do update set bottle_product_id = excluded.bottle_product_id;
                        ";
                        await using var upCmd = db.CreateCommand(upSql);
                        upCmd.Parameters.AddWithValue(row.IngredientId);
                        upCmd.Parameters.AddWithValue(row.BottleProductId.Value);
                        await upCmd.ExecuteNonQueryAsync();
                    }
                }

                return Results.Ok();
            });
        });
    }
}
