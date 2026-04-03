using Npgsql;

namespace RestaurantSys.Api.Endpoints;

internal sealed class OrderRouteResult
{
    public Guid? OriginStationId { get; init; }
    public Guid? RevenueCenterId { get; init; }
    public Guid? CheckerStationId { get; init; }
    public string? CheckerStationName { get; init; }
}

internal static class OrderRoutingResolver
{
    public static async Task<OrderRouteResult> ResolveAsync(
        NpgsqlConnection conn,
        Guid? originStationId,
        NpgsqlTransaction? tx = null,
        CancellationToken ct = default)
    {
        if (originStationId is null || originStationId == Guid.Empty)
        {
            return new OrderRouteResult();
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
                CheckerStationId = null
            };
        }

        const string checkerSql = """
            select station_id, station_name
            from stations
            where station_type = 'Checker'
              and checker_revenue_center_id = @revenue_center_id
            order by station_name, station_id
            limit 1;
            """;

        Guid? checkerStationId = null;
        string? checkerStationName = null;

        await using (var checkerCmd = new NpgsqlCommand(checkerSql, conn, tx))
        {
            checkerCmd.Parameters.AddWithValue("revenue_center_id", revenueCenterId.Value);
            await using var reader = await checkerCmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                checkerStationId = reader.GetGuid(0);
                checkerStationName = reader.GetString(1);
            }
        }

        return new OrderRouteResult
        {
            OriginStationId = originStationId,
            RevenueCenterId = revenueCenterId,
            CheckerStationId = checkerStationId,
            CheckerStationName = checkerStationName
        };
    }
}
