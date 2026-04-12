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
        app.MapGet("/api/stations/{stationId:guid}/checker-settings", async (Guid stationId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = """
                    select
                      s.station_id,
                      s.checker_revenue_center_id,
                      rc.name,
                      s.checker_print_enabled,
                      s.checker_product_scope
                    from stations s
                    left join revenue_centers rc
                      on rc.revenue_center_id = s.checker_revenue_center_id
                    where s.station_id = @station_id
                      and s.station_type = 'Checker'
                    limit 1;
                    """;

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("station_id", stationId);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound(new { error = "Checker station not found." });
                }

                return Results.Json(new CheckerStationSettingsDto
                {
                    StationId = reader.GetGuid(0),
                    RevenueCenterId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1),
                    RevenueCenterName = reader.IsDBNull(2) ? null : reader.GetString(2),
                    PrintEnabled = !reader.IsDBNull(3) && reader.GetBoolean(3),
                    ProductScope = reader.IsDBNull(4) ? "both" : reader.GetString(4)
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/stations/{stationId}/checker-settings:\n" + ex);
                return Results.Problem("Failed to load checker settings.", statusCode: 500);
            }
        });

        app.MapPut("/api/stations/{stationId:guid}/checker-settings", async (Guid stationId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                Guid? revenueCenterId = null;
                var hasRevenueCenter = false;
                if (body.TryGetProperty("revenueCenterId", out var revenueCenterEl))
                {
                    hasRevenueCenter = true;
                    if (revenueCenterEl.ValueKind == JsonValueKind.String &&
                        Guid.TryParse(revenueCenterEl.GetString(), out var parsedRevenueCenterId))
                    {
                        revenueCenterId = parsedRevenueCenterId;
                    }
                    else if (revenueCenterEl.ValueKind != JsonValueKind.Null)
                    {
                        return Results.BadRequest(new { error = "revenueCenterId must be a GUID or null." });
                    }
                }

                bool? printEnabled = null;
                if (body.TryGetProperty("printEnabled", out var printEnabledEl))
                {
                    if (printEnabledEl.ValueKind == JsonValueKind.True || printEnabledEl.ValueKind == JsonValueKind.False)
                    {
                        printEnabled = printEnabledEl.GetBoolean();
                    }
                    else if (printEnabledEl.ValueKind != JsonValueKind.Null)
                    {
                        return Results.BadRequest(new { error = "printEnabled must be a boolean." });
                    }
                }

                string? productScope = null;
                if (body.TryGetProperty("productScope", out var productScopeEl))
                {
                    if (productScopeEl.ValueKind == JsonValueKind.String)
                    {
                        productScope = NormalizeCheckerProductScope(productScopeEl.GetString());
                        if (productScope is null)
                        {
                            return Results.BadRequest(new { error = "productScope must be food, drinks, or both." });
                        }
                    }
                    else if (productScopeEl.ValueKind != JsonValueKind.Null)
                    {
                        return Results.BadRequest(new { error = "productScope must be a string." });
                    }
                }

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                const string checkerExistsSql = """
                    select 1
                    from stations
                    where station_id = @station_id
                      and station_type = 'Checker'
                    limit 1;
                    """;

                await using (var checkerExistsCmd = new NpgsqlCommand(checkerExistsSql, conn, tx))
                {
                    checkerExistsCmd.Parameters.AddWithValue("station_id", stationId);
                    if (await checkerExistsCmd.ExecuteScalarAsync() is null)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Checker station not found." });
                    }
                }

                if (hasRevenueCenter && revenueCenterId is Guid selectedRevenueCenterId)
                {
                    const string revenueCenterExistsSql = """
                        select 1
                        from revenue_centers
                        where revenue_center_id = @revenue_center_id
                        limit 1;
                        """;

                    await using var revenueCenterCmd = new NpgsqlCommand(revenueCenterExistsSql, conn, tx);
                    revenueCenterCmd.Parameters.AddWithValue("revenue_center_id", selectedRevenueCenterId);
                    if (await revenueCenterCmd.ExecuteScalarAsync() is null)
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = "Revenue center not found." });
                    }
                }

                var setParts = new List<string>();
                if (hasRevenueCenter)
                    setParts.Add("checker_revenue_center_id = @revenue_center_id");
                if (printEnabled is not null)
                    setParts.Add("checker_print_enabled = @print_enabled");
                if (productScope is not null)
                    setParts.Add("checker_product_scope = @product_scope");

                if (setParts.Count == 0)
                {
                    await tx.RollbackAsync();
                    return Results.BadRequest(new { error = "Nothing to update." });
                }

                var updateSql = $"""
                    update stations
                    set {string.Join(", ", setParts)}
                    where station_id = @station_id
                    returning station_id, checker_revenue_center_id, checker_print_enabled, checker_product_scope;
                    """;

                Guid? savedRevenueCenterId = null;
                bool savedPrintEnabled = false;
                string savedProductScope = "both";

                await using (var updateCmd = new NpgsqlCommand(updateSql, conn, tx))
                {
                    updateCmd.Parameters.AddWithValue("station_id", stationId);
                    if (hasRevenueCenter)
                    {
                        var param = updateCmd.Parameters.Add("revenue_center_id", NpgsqlTypes.NpgsqlDbType.Uuid);
                        param.Value = revenueCenterId is Guid value ? value : DBNull.Value;
                    }
                    if (printEnabled is not null)
                    {
                        updateCmd.Parameters.AddWithValue("print_enabled", printEnabled.Value);
                    }
                    if (productScope is not null)
                    {
                        updateCmd.Parameters.AddWithValue("product_scope", productScope);
                    }

                    await using var reader = await updateCmd.ExecuteReaderAsync();
                    await reader.ReadAsync();
                    savedRevenueCenterId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1);
                    savedPrintEnabled = !reader.IsDBNull(2) && reader.GetBoolean(2);
                    savedProductScope = reader.IsDBNull(3) ? "both" : reader.GetString(3);
                }

                string? revenueCenterName = null;
                if (savedRevenueCenterId is Guid finalRevenueCenterId)
                {
                    const string revenueCenterNameSql = """
                        select name
                        from revenue_centers
                        where revenue_center_id = @revenue_center_id
                        limit 1;
                        """;

                    await using var nameCmd = new NpgsqlCommand(revenueCenterNameSql, conn, tx);
                    nameCmd.Parameters.AddWithValue("revenue_center_id", finalRevenueCenterId);
                    revenueCenterName = await nameCmd.ExecuteScalarAsync() as string;
                }

                await tx.CommitAsync();

                return Results.Json(new CheckerStationSettingsDto
                {
                    StationId = stationId,
                    RevenueCenterId = savedRevenueCenterId,
                    RevenueCenterName = revenueCenterName,
                    PrintEnabled = savedPrintEnabled,
                    ProductScope = savedProductScope
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (PostgresException ex) when (ex.SqlState == "23505")
            {
                return Results.BadRequest(new { error = "This revenue center already has a checker station with the same product scope." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PUT /api/stations/{stationId}/checker-settings:\n" + ex);
                return Results.Problem("Failed to save checker settings.", statusCode: 500);
            }
        });

        /* GET /api/checker/orders */
        app.MapGet("/api/checker/orders", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                Guid? stationId = null;
                if (Guid.TryParse(req.Query["stationId"], out var parsedStationId))
                {
                    stationId = parsedStationId;
                }

const string sql = @"
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
  oi.order_item_id,
  coalesce(p.name, '[missing product]') as product_name,
  oi.quantity,
  case when oi.item_status = 'ready' then oi.quantity else 0 end as done,
  (oi.item_status = 'ready') as verified,
  (oi.item_status = 'cancelled') as cancelled
from orders o
left join tables t on t.table_id = o.table_id
join order_items oi on oi.order_id = o.order_id
left join products p on p.product_id = oi.product_id
where o.status = 'open'
  and coalesce(oi.item_status, '') <> 'served'
  and (
    @station_id is null
    or coalesce(oi.checker_station_id, o.checker_station_id) = @station_id
    or (@station_id is null and coalesce(oi.checker_station_id, o.checker_station_id) is null)
  )
order by o.opened_at, oi.created_at;
";

                var map = new Dictionary<Guid, CheckerOrderDto>();

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)stationId ?? DBNull.Value);
                await using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    var orderId = reader.GetGuid(0);
                    var openedAt = reader.GetDateTime(1);
                    var source = reader.IsDBNull(2) ? "" : reader.GetString(2);

                    var orderItemId = reader.GetGuid(3);
                    var productName = reader.IsDBNull(4) ? "[missing product]" : reader.GetString(4);

                    var qty = reader.GetInt32(5);
                    var done = reader.GetInt32(6);
                    var verified = reader.GetBoolean(7);
                    var cancelled = reader.GetBoolean(8);

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
                    Id = orderItemId,
                    Name = productName,
                    Qty = qty,
                    Done = done,
                    Verified = verified,
                    Cancelled = cancelled
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

        /* PATCH /api/checker/orders/{orderId}/items/{orderItemId}/ready */
        app.MapPatch("/api/checker/orders/{orderId:guid}/items/{orderItemId:guid}/ready",
        async (Guid orderId, Guid orderItemId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
update order_items
   set item_status = 'ready'
 where order_id = @order_id
   and order_item_id = @order_item_id
   and coalesce(item_status,'') <> 'cancelled';
";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_id", orderId);
                cmd.Parameters.AddWithValue("order_item_id", orderItemId);

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
        async (Guid orderId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                Guid? stationId = null;
                if (Guid.TryParse(req.Query["stationId"], out var parsedStationId))
                {
                    stationId = parsedStationId;
                }

                const string sql = @"
update order_items
   set item_status = 'served'
 where order_id = @order_id
   and coalesce(item_status,'') not in ('cancelled', 'served')
   and (
         @station_id is null
      or coalesce(checker_station_id, (
            select checker_station_id
            from orders
            where order_id = @order_id
         )) = @station_id
   );
";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_id", orderId);
                cmd.Parameters.AddWithValue("station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)stationId ?? DBNull.Value);

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

    private static string? NormalizeCheckerProductScope(string? raw)
    {
        return raw?.Trim().ToLowerInvariant() switch
        {
            "food" => "food",
            "drinks" => "drinks",
            "both" => "both",
            _ => null
        };
    }
}
