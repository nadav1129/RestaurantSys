using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using RestaurantSys.Api;
using RestaurantSys.Api.Endpoints;
using RestaurantSys.ManagementApi.Diagnostics;
using RestaurantSys.ManagementApi.Management.Menu;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;


var builder = WebApplication.CreateBuilder(args);

// TODO: move to config/env var for real use
const string JwtKey = "super-secret-dev-key-change-me";

// JWT auth
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();


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

// register tests
builder.Services.AddSingleton<ITestCase, DbBasicQueryTest>();
builder.Services.AddSingleton<TestRegistry>();

var app = builder.Build();
app.UseCors();

app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine("UNHANDLED ERROR: " + ex);
        if (!ctx.Response.HasStarted)
        {
            ctx.Response.StatusCode = 500;
            ctx.Response.ContentType = "application/json";
        }
        // keep it minimal so we don't throw again
        await ctx.Response.WriteAsync("{\"error\":\"Unhandled server error\"}");
    }
});


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

/* ============ Route register ============ */
// Menu
app.MapMenusEndpoints();
app.MapMenuNodesEndpoints();
app.MapIngredientsEndpoints();
app.MapProductsEndpoints();
app.MapPricesEndpoints();
//app.MapSpeedMapEndpoints();

// Menagement
app.MapSettingsEndpoints();
app.MapListStationsEndpoints();
app.MapTableStationsEndpoints();

//Stations
app.MapStationsEndpoints();
app.MapListEndpoints();
app.MapCheckerEndpoints();

// Shifts
app.MapShiftEndpoints();
app.MapShiftWorkersEndpoints(); 

// Orders
app.MapOrderEndpoints();
app.MapOrderRouteEndpoints();

// User
app.MapWorkerEndpoints();
app.MapUserEndpoints();

// JWT
app.UseAuthentication();
app.UseAuthorization();

// TESTS
app.MapDevTestsEndpoints();

// minimal health
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
