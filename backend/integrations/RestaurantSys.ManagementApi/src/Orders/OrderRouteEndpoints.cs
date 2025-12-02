using System.Text.Json;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class OrderRouteEndpoints
{
    public static void MapOrderRouteEndpoints(this WebApplication app)
    {
        /* =========================================
           POST /api/orders/route   (no-op router sink)
           Accepts a draft order payload for routing
           CURRENTLY: does nothing and returns 204
           ========================================= */
        app.MapPost("/api/orders/route", async (HttpRequest req) =>
        {
            // Intentionally ignore the body for now; just drain stream
            // so clients can POST large carts without 500s.
            // Future: parse and fan-out to Checker/Bar production queues.
            try
            {
                // Drain stream (optional)
                using var ms = new MemoryStream();
                await req.Body.CopyToAsync(ms);
            }
            catch { /* ignore */ }

            return Results.NoContent();
        });
    }
}