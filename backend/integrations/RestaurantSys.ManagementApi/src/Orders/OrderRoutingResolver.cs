using Npgsql;

namespace RestaurantSys.Api.Endpoints;

internal sealed class OrderRouteResult
{
    public Guid? OriginStationId { get; init; }
    public Guid? RevenueCenterId { get; init; }
    public Guid? CheckerStationId { get; init; }
    public string? CheckerStationName { get; init; }
    public string ProductScope { get; init; } = "both";
}

internal static class OrderRoutingResolver
{
    public static async Task<OrderRouteResult> ResolveAsync(
        NpgsqlConnection conn,
        Guid? originStationId,
        NpgsqlTransaction? tx = null,
        CancellationToken ct = default)
    {
        return await ResolveForScopeAsync(conn, originStationId, "both", tx, ct);
    }

    public static async Task<OrderRouteResult> ResolveForProductAsync(
        NpgsqlConnection conn,
        Guid? originStationId,
        Guid productId,
        NpgsqlTransaction? tx = null,
        CancellationToken ct = default)
    {
        var scope = await ResolveProductScopeAsync(conn, productId, tx, ct);
        return await ResolveForScopeAsync(conn, originStationId, scope, tx, ct);
    }

    public static async Task<string> ResolveProductScopeAsync(
        NpgsqlConnection conn,
        Guid productId,
        NpgsqlTransaction? tx = null,
        CancellationToken ct = default)
    {
        const string sql = """
            select type
            from products
            where product_id = @product_id
            limit 1;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("product_id", productId);

        var productType = await cmd.ExecuteScalarAsync(ct) as string;
        return ClassifyProductScope(productType);
    }

    private static async Task<OrderRouteResult> ResolveForScopeAsync(
        NpgsqlConnection conn,
        Guid? originStationId,
        string requestedScope,
        NpgsqlTransaction? tx,
        CancellationToken ct)
    {
        if (originStationId is null || originStationId == Guid.Empty)
        {
            return new OrderRouteResult { ProductScope = requestedScope };
        }

        Guid? revenueCenterId = null;

        const string originSql = """
            select revenue_center_id
            from stations
            where station_id = @station_id
              and station_type in ('Bar', 'Floor')
            limit 1;
            """;

        await using (var originCmd = new NpgsqlCommand(originSql, conn, tx))
        {
            originCmd.Parameters.AddWithValue("station_id", originStationId.Value);
            var value = await originCmd.ExecuteScalarAsync(ct);
            if (value is Guid foundRevenueCenterId)
            {
                revenueCenterId = foundRevenueCenterId;
            }
        }

        if (revenueCenterId is null)
        {
            return new OrderRouteResult
            {
                OriginStationId = originStationId,
                RevenueCenterId = null,
                CheckerStationId = null,
                ProductScope = requestedScope
            };
        }

        const string checkerSql = """
            select station_id, station_name, checker_product_scope
            from stations
            where station_type = 'Checker'
              and checker_revenue_center_id = @revenue_center_id
              and checker_product_scope in (@requested_scope, 'both')
            order by
              case when checker_product_scope = @requested_scope then 0 else 1 end,
              station_name,
              station_id
            limit 1;
            """;

        Guid? checkerStationId = null;
        string? checkerStationName = null;
        string resolvedScope = requestedScope;

        await using (var checkerCmd = new NpgsqlCommand(checkerSql, conn, tx))
        {
            checkerCmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId.Value);
            checkerCmd.Parameters.AddWithValue("requested_scope", requestedScope);
            await using var reader = await checkerCmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                checkerStationId = reader.GetGuid(0);
                checkerStationName = reader.GetString(1);
                resolvedScope = reader.IsDBNull(2) ? requestedScope : reader.GetString(2);
            }
        }

        return new OrderRouteResult
        {
            OriginStationId = originStationId,
            RevenueCenterId = revenueCenterId,
            CheckerStationId = checkerStationId,
            CheckerStationName = checkerStationName,
            ProductScope = resolvedScope
        };
    }

    internal static string ClassifyProductScope(string? productType)
    {
        var normalized = (productType ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Contains("food") || normalized.Contains("dessert"))
        {
            return "food";
        }

        return "drinks";
    }
}
