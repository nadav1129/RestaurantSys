// Diagnostics/TestRegistry.cs
public sealed class TestRegistry
{
    public IReadOnlyList<ITestCase> Tests { get; }

    public TestRegistry(IEnumerable<ITestCase> tests)
    {
        Tests = tests.ToList();
    }

    public IEnumerable<ITestCase> GetByCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category))
            return Tests;
        return Tests.Where(t => string.Equals(t.Category, category,
                                              StringComparison.OrdinalIgnoreCase));
    }
}
