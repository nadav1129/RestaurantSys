using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace RestaurantSys.Api.Endpoints;

public static class CheckerEndpoints
{
    public static void MapCheckerEndpoints(this WebApplication app)
    {
        // GET /api/checker/orders
        // Returns all *open* orders with their items, grouped per order.
        // Shape matches CheckerPage.tsx (CheckerOrder + MealLine).
        app.MapGet("/api/checker/orders", async (NpgsqlDataSource db) =>
        {
            const string sql = @"
      select
        o.order_id,
        coalesce('Table ' || t.table_number::text, 'None') as table_label,
        o.opened_at,
        p.product_id,
        p.name,
        sum(oi.quantity) as qty
      from orders o
      left join tables      t  on t.table_id = o.table_id
      join order_items      oi on oi.order_id   = o.order_id
      join products         p  on p.product_id  = oi.product_id
      where o.status = 'open'
      group by
        o.order_id, table_label, o.opened_at, p.product_id, p.name
      order by o.opened_at;
    ";

            var dict = new Dictionary<Guid, CheckerOrderDto>();

            await using var cmd = db.CreateCommand(sql);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var orderId = reader.GetGuid(0);
                var tableLabel = reader.IsDBNull(1) ? "None" : reader.GetString(1);
                var openedAt = reader.GetDateTime(2);
                var productId = reader.GetGuid(3);
                var productName = reader.GetString(4);
                var qty = reader.GetInt32(5);

                if (!dict.TryGetValue(orderId, out var dto))
                {
                    dto = new CheckerOrderDto
                    {
                        Id = orderId,
                        Table = tableLabel,
                        CreatedAt = openedAt,
                        Meals = new List<CheckerMealDto>()
                    };
                    dict.Add(orderId, dto);
                }

                dto.Meals.Add(new CheckerMealDto
                {
                    Id = productId,
                    Name = productName,
                    Qty = qty,
                    Done = 0,
                    Verified = false
                });
            }

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            return Results.Json(dict.Values, options);
        });

    }
}