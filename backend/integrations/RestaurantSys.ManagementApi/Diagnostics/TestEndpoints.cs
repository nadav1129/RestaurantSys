// backend/src/RestaurantSys.ManagementApi/Diagnostics/Tests/DbBasicQueryTest.cs
using Npgsql;

public sealed class DbBasicQueryTest : ITestCase
{
    private readonly NpgsqlDataSource _db;

    public DbBasicQueryTest(NpgsqlDataSource db)
    {
        _db = db;
    }

    public string Id => "db.basic-query";
    public string Category => "api";     /* or "db" */
    public string Description => "Can run a simple SELECT 1 on Postgres.";

    public async Task<TestResult> RunAsync(CancellationToken ct = default)
    {
        var result = new TestResult
        {
            Id = Id,
            Category = Category,
            Description = Description
        };

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await using var cmd = _db.CreateCommand("SELECT 1;");
            var value = await cmd.ExecuteScalarAsync(ct);
            result.Logs.Add($"SELECT 1 returned: {value}");
            result.Success = true;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Error = ex.Message;
            result.Logs.Add(ex.ToString());
        }
        finally
        {
            sw.Stop();
            result.DurationMs = sw.Elapsed.TotalMilliseconds;
        }

        return result;
    }
}
