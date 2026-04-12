using System.Text.Json;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class OrderRouteEndpoints
{
    public static void MapOrderRouteEndpoints(this WebApplication app)
    {
        /* =========================================
           POST /api/orders/route
           Resolves which checker station should receive an order
           based on the origin station's revenue center.
           ========================================= */
        app.MapPost("/api/orders/route", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                Guid? originStationId = null;
                if (TryGetGuid(body, "originStationId", out var parsedOriginStationId) && parsedOriginStationId != Guid.Empty)
                    originStationId = parsedOriginStationId;
                else if (TryGetGuid(body, "stationId", out var parsedStationId) && parsedStationId != Guid.Empty)
                    originStationId = parsedStationId;

                Guid? productId = null;
                if (TryGetGuid(body, "productId", out var parsedProductId) && parsedProductId != Guid.Empty)
                    productId = parsedProductId;

                await using var conn = await db.OpenConnectionAsync();
                var route = productId is Guid pid
                    ? await OrderRoutingResolver.ResolveForProductAsync(conn, originStationId, pid)
                    : await OrderRoutingResolver.ResolveAsync(conn, originStationId);

                return Results.Json(new
                {
                    originStationId,
                    productId,
                    revenueCenterId = route.RevenueCenterId,
                    productScope = route.ProductScope,
                    checkerStationId = route.CheckerStationId,
                    checkerStationName = route.CheckerStationName
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/orders/route:\n" + ex);
                return Results.Problem("POST /api/orders/route failed", statusCode: 500);
            }
        });
    }

    private static bool TryGetGuid(JsonElement obj, string name, out Guid value)
    {
        value = Guid.Empty;
        if (!obj.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.String)
            return false;
        return Guid.TryParse(p.GetString(), out value);
    }
}
