// backend/src/RestaurantSys.ManagementApi/Diagnostics/ITestCase.cs
public interface ITestCase
{
    string Id { get; }          // e.g. "db.basic-query"
    string Category { get; }    // e.g. "api", "db", "e2e"
    string Description { get; } // human-friendly
    Task<TestResult> RunAsync(CancellationToken ct = default);
}

public sealed class TestResult
{
    public string Id { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public bool Success { get; set; }
    public string? Error { get; set; }
    public List<string> Logs { get; set; } = new();
    public double DurationMs { get; set; }
}
