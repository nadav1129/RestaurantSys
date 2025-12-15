using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class CheckerEndpoints
{
    public static void MapCheckerEndpoints(this WebApplication app)
    {
        /* GET /api/checker/orders */
        app.MapGet("/api/checker/orders", async (NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
with x as (
  select
    o.order_id,
    o.opened_at,
    case
      when o.guest_name is not null and length(btrim(o.guest_name)) > 0
        then o.guest_name
      when t.table_number is not null
        then 'Table ' || t.table_number::text
      else
        'Quick'
    end as source_label,
    oi.product_id,
    coalesce(p.name, '[missing product]') as product_name,
    oi.quantity,
    oi.item_status
  from orders o
  left join tables t on t.table_id = o.table_id
  join order_items oi on oi.order_id = o.order_id
  left join products p on p.product_id = oi.product_id
  where o.status = 'open'
)
select
  order_id,
  opened_at,
  source_label,
  product_id,
  product_name,
  sum(quantity)::int as qty,
  sum(case when item_status = 'ready' then quantity else 0 end)::int as done,
  coalesce(bool_and(item_status = 'ready'), false) as verified
from x
group by
  order_id, opened_at, source_label, product_id, product_name
order by opened_at;
";

                var map = new Dictionary<Guid, CheckerOrderDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    var orderId = reader.GetGuid(0);
                    var openedAt = reader.GetDateTime(1);
                    var source = reader.IsDBNull(2) ? "" : reader.GetString(2);

                    var productId = reader.GetGuid(3);
                    var productName = reader.IsDBNull(4) ? "[missing product]" : reader.GetString(4);

                    var qty = reader.GetInt32(5);
                    var done = reader.GetInt32(6);
                    var verified = reader.GetBoolean(7);

                    if (!map.TryGetValue(orderId, out var order))
                    {
                        order = new CheckerOrderDto
                        {
                            OrderId = orderId,
                            Table = source,
                            CreatedAt = openedAt,
                            Meals = new List<CheckerMealDto>()
                        };
                        map.Add(orderId, order);
                    }

                    order.Meals.Add(new CheckerMealDto
                    {
                        Id = productId,
                        Name = productName,
                        Qty = qty,
                        Done = done,
                        Verified = verified
                    });
                }

                return Results.Json(
                    map.Values.ToList(),
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/checker/orders:\n" + ex);
                return Results.Problem("GET /api/checker/orders failed", statusCode: 500);
            }
        });

        /* PATCH /api/checker/orders/{orderId}/items/{productId}/ready */
        app.MapPatch("/api/checker/orders/{orderId:guid}/items/{productId:guid}/ready",
        async (Guid orderId, Guid productId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
update order_items
   set item_status = 'ready'
 where order_id = @order_id
   and product_id = @product_id
   and coalesce(item_status,'') <> 'cancelled';
";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_id", orderId);
                cmd.Parameters.AddWithValue("product_id", productId);

                var affected = await cmd.ExecuteNonQueryAsync();

                return Results.Json(
                    new { ok = true, affected },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PATCH ready:\n" + ex);
                return Results.Problem("Failed to mark item ready.", statusCode: 500);
            }
        });

        /* PATCH /api/checker/orders/{orderId}/dismiss */
        app.MapPatch("/api/checker/orders/{orderId:guid}/dismiss",
        async (Guid orderId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
update orders
   set status = 'closed'
 where order_id = @order_id
   and status = 'open';
";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_id", orderId);

                var affected = await cmd.ExecuteNonQueryAsync();

                return Results.Json(
                    new { ok = true, affected },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PATCH dismiss:\n" + ex);
                return Results.Problem("Failed to dismiss order.", statusCode: 500);
            }
        });

    }
}
