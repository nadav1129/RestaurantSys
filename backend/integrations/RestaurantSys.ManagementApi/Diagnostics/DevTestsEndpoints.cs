using System.Text.Json;

namespace RestaurantSys.ManagementApi.Diagnostics;

internal static class DevTestsEndpoints
{
    public static IEndpointRouteBuilder MapDevTestsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/api/dev/tests")
            .WithTags("DevTests");

        group.MapPost("/run", async (
            HttpRequest req,
            TestRegistry registry,
            CancellationToken ct) =>
        {
            string? category = null;

            // optional JSON body: { "category": "api" }
            using (var reader = new StreamReader(req.Body))
            {
                var body = await reader.ReadToEndAsync(ct);
                if (!string.IsNullOrWhiteSpace(body))
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("category", out var el))
                        category = el.GetString();
                }
            }

            var tests = registry.GetByCategory(category).ToList();
            var results = new List<TestResult>();

            foreach (var t in tests)
            {
                var res = await t.RunAsync(ct);
                results.Add(res);
            }

            return Results.Json(results, new System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
            });
        });

        return app;
    }
}
