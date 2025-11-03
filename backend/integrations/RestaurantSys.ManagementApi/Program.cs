using System.Data;
using Npgsql;

using RestaurantSys.Api;


var builder = WebApplication.CreateBuilder(args);

// bind predictable dev port
builder.WebHost.UseUrls("http://0.0.0.0:8080");

// connection string: env > appsettings > fallback
var connString =
    Environment.GetEnvironmentVariable("POSTGRES_CONNECTION") ??
    builder.Configuration.GetConnectionString("postgres") ??
    "Host=localhost;Port=5434;Username=postgres;Password=postgres;Database=postgres";

// log target (without password)
var csb = new NpgsqlConnectionStringBuilder(connString) { Password = null };
Console.WriteLine($"[DB] Host={csb.Host} Port={csb.Port} Db={csb.Database} User={csb.Username}");

// shared datasource for endpoints
var dataSource = NpgsqlDataSource.Create(connString);
builder.Services.AddSingleton(dataSource);

// very open CORS for local dev
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().AllowCredentials().SetIsOriginAllowed(_ => true)));

var app = builder.Build();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// ---- ONE FILE MIGRATION (run every boot) ----
var schemaPath = Path.Combine(app.Environment.ContentRootPath, "sql", "schema.sql");
if (!File.Exists(schemaPath))
{
    app.Logger.LogWarning("schema.sql not found at {Path}. Skipping DB init.", schemaPath);
}
else
{
    try
    {
        var sql = await File.ReadAllTextAsync(schemaPath);

        await using var conn = await dataSource.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.Serializable);

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = sql;
            cmd.CommandType = CommandType.Text;
            cmd.CommandTimeout = 0; // allow long schema ops
            await cmd.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
        app.Logger.LogInformation("Applied schema.sql successfully.");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "schema.sql execution failed.");
        throw;
    }
}
// register all routes from ManagementApi.cs
app.MapManagementApi();

// minimal health
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
