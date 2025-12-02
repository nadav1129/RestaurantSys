using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class PricesEndpoints
{
    public static void MapPricesEndpoints(this WebApplication app)
    {
        // ===== PRICES =====
        // POST /api/product-prices
        app.MapPost("/api/product-prices", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var opts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var body = await req.ReadFromJsonAsync<UpsertProductPriceRequest>(opts);
                Console.WriteLine($"[POST /api/product-prices] pid={body?.ProductId} menu={body?.MenuNum} price={body?.Price}");

                if (body is null) return Results.BadRequest(new { error = "Invalid JSON." });
                if (body.ProductId == Guid.Empty) return Results.BadRequest(new { error = "ProductId is required." });
                if (body.MenuNum <= 0) return Results.BadRequest(new { error = "menuNum must be positive." });

                const string sql = @"
        insert into public.product_prices (product_id, menu_num, price)
        values (@pid, @menu, @price)
        on conflict on constraint product_prices_pkey
        do update set price = excluded.price;
    ";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, body.ProductId);
                cmd.Parameters.AddWithValue("@menu", NpgsqlTypes.NpgsqlDbType.Integer, body.MenuNum);
                cmd.Parameters.AddWithValue("@price", NpgsqlTypes.NpgsqlDbType.Numeric, (object?)body.Price ?? DBNull.Value);
                await cmd.ExecuteNonQueryAsync();
                return Results.NoContent();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/products-prices:\n" + ex);
                return Results.Problem($"POST /api/products-prices failed: {ex.Message}", statusCode: 500);
            }
        });
    }
}
