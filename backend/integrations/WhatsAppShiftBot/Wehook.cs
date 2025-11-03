using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using RestaurantSys.Domain;
using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics.Metrics;
using System.Security;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WhatsAppWebhook.Application.Commands;
using WhatsAppWebhook.Application.Nlu;

var builder = WebApplication.CreateBuilder(args);

/* Force Kestrel to :8080 */
builder.WebHost.UseUrls("http://localhost:8080");

/* Logging */
builder.Services.AddLogging(c => c.AddConsole());

/* Force Postgres to 5434 */
var pgConn = "Host=127.0.0.1;Port=5434;Username=postgres;Password=postgres;Database=postgres";
builder.Services.AddSingleton<NpgsqlDataSource>(_ => NpgsqlDataSource.Create(pgConn));
// NpgsqlDataSource singleton
var connString = builder.Configuration.GetConnectionString("pg")
                 ?? "Host=localhost;Port=5433;Username=postgres;Password=postgres;Database=postgres";
builder.Services.AddSingleton(NpgsqlDataSource.Create(connString));

/* NLU + Commands + Idempotency */
builder.Services.AddSingleton<IIntentParser, RuleBasedParser>();
builder.Services.AddSingleton<IIdempotencyStore, PgIdempotencyStore>();
builder.Services.AddScoped<CommandRouter>();
builder.Services.AddSingleton(new TipFormulaConfig(
    TaxPercentB: 12.0m,
    ManagersPercentC: 10.0m,
    Rules: new[]
    {
        new RoleRule("Waiter",     true,  false, false, 45m),
        new RoleRule("Hostess",    true,  false, false, 40m),
        new RoleRule("Bartender",  true,  false, false, 50m),
        new RoleRule("Dishwasher", false, false, true,  null),
        new RoleRule("Manager",    false, true,  false, null),
    }
));

var publicBaseUrl = builder.Configuration["PublicBaseUrl"]
                    ?? "https://<your-tunnel>.trycloudflare.com";
builder.Services.AddSingleton(sp =>
{
    var db = sp.GetRequiredService<NpgsqlDataSource>();
    var tip = sp.GetRequiredService<TipFormulaConfig>();
    return new CommandRouter(db, tip, publicBaseUrl);
});

var app = builder.Build();

/* Health check: GET / → 200 OK */
app.MapGet("/", () => Results.Ok("OK"));

/* Twilio minimal echo handler: POST /twilio/adapter-test
   Accepts form-encoded fields and returns TwiML XML so Twilio replies on WhatsApp. */
app.MapPost("/twilio/adapter-test", async (HttpRequest req, ILogger<Program> log) =>
{
    var form = await req.ReadFormAsync();

    var from = form["From"].ToString();          // e.g., "whatsapp:+9725..."
    var body = form["Body"].ToString();          // e.g., "ping"
    var msgSid = form["MessageSid"].ToString();  // idempotency key if you need

    log.LogInformation("TWILIO IN: From={From} Body={Body} Sid={Sid}", from, body, msgSid);

    var reply = $"Echo: {body} (from {from})";

    var xmlOk = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>"
                + System.Security.SecurityElement.Escape(reply)
                + "</Message></Response>";

    return Results.Content(xmlOk, "text/xml");
});


/* ----------------- Twilio → Meta adapter (form → unified core) ----------------- */
/*  */
app.MapPost("/twilio/adapter", async (
    HttpRequest req,
    NpgsqlDataSource db,
    ILogger<Program> log,
    IIntentParser nlu,
    CommandRouter router,
    IIdempotencyStore idem) =>
{
    try
    {
        if (!req.HasFormContentType)
        {
            const string bad = "<?xml version=\"1.0\"?><Response><Message>Bad content type</Message></Response>";
            return Results.Content(bad, "text/xml");
        }

        var form = await req.ReadFormAsync();
        var messageId = form["MessageSid"].ToString();
        var from = form["From"].ToString();              // "whatsapp:+9725..."
        var body = form["Body"].ToString() ?? string.Empty;

        // Normalize to +E.164 (strip "whatsapp:")
        // Checks if the string begins with "whatsapp:" (case-insensitive).
        // If true, take everything after that prefix:
        var fromE164 = from.StartsWith("whatsapp:", StringComparison.OrdinalIgnoreCase)
            ? from.Substring("whatsapp:".Length)
            : from;
        Console.WriteLine($"[FROM] raw='{from}'  e164='{fromE164}'");

        // Do the work inline so the insert actually happens before replying
        var reply = await ChatLogic.HandleInboundCore(db, log, nlu, router, idem, messageId, fromE164, body);

        // TwiML(Twilio expected reply form) reply (what you see in WhatsApp)
        var xmlOk = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>"
                    + SecurityElement.Escape(reply)
                    + "</Message></Response>";
        return Results.Content(xmlOk, "text/xml");
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Twilio adapter error");
        const string xmlErr = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>Server error</Message></Response>";
        return Results.Content(xmlErr, "text/xml");
    }
});

/* ----------------- Meta Cloud API webhook (JSON → unified core) ----------------- */
app.MapPost("/webhook/whatsapp", async (
    HttpRequest req,
    NpgsqlDataSource db,
    ILogger log,
    IIntentParser nlu,
    CommandRouter router,
    IIdempotencyStore idem) =>
{
    using var doc = await JsonDocument.ParseAsync(req.Body);
    var root = doc.RootElement;
    var entry = root.GetProperty("entry")[0].GetProperty("changes")[0].GetProperty("value");
    var msg = entry.GetProperty("messages")[0];

    var messageId = msg.GetProperty("id").GetString() ?? string.Empty;
    var fromPhone = msg.GetProperty("from").GetString() ?? string.Empty;  /* usually digits without '+' */
    var text = msg.GetProperty("text").GetProperty("body").GetString() ?? string.Empty;

    if (!fromPhone.StartsWith("+")) fromPhone = "+" + fromPhone;

    var reply = await ChatLogic.HandleInboundCore(db, log, nlu, router, idem, messageId, fromPhone, text);
    return Results.Text(reply, "text/plain");
});

/* Health ping (optional) */
app.MapGet("/health", () => Results.Ok(new { ok = true }));

/* Run the app — NOTE: last statement before the class below */
app.Run();

/* ----------------- NO TOP-LEVEL STATEMENTS AFTER THIS LINE ----------------- */
static class ChatLogic
{
    public static async Task<string> HandleInboundCore(
        NpgsqlDataSource db,
        ILogger log,
        IIntentParser nlu,
        CommandRouter router,
        IIdempotencyStore idem,
        string messageId,
        string fromE164,
        string textRaw)
    {
        var text = (textRaw ?? string.Empty).Trim();

        /* Idempotency */
        if (string.IsNullOrWhiteSpace(messageId))
            messageId = $"{fromE164}|{text}|{DateTimeOffset.UtcNow:yyyyMMddHHmm}";
        if (!await idem.TryBeginAsync(messageId))
            return "✅ Already processed.";

        try
        {
            /* Optional: current phone→worker lookup (kept only for logs / future use) */
            Guid? workerId = null;
            await using (var c1 = db.CreateCommand(
                "select worker_id from public.workers where phone_e164=$1"))
            {
                c1.Parameters.AddWithValue(fromE164);
                await using var r = await c1.ExecuteReaderAsync();
                if (await r.ReadAsync()) workerId = r.GetGuid(0);
            }
            Console.WriteLine($"[LOOKUP] phone='{fromE164}'  workerId={(workerId?.ToString() ?? "null")}");

            /* Parse → Route (only the streamlined commands) */
            var parsed = nlu.Parse(text);
            Console.WriteLine($"[INTENT] intent={parsed.Intent} text='{text}'");

            var reply = await router.HandleAsync(fromE164, text, parsed);
            return reply;
        }
        finally
        {
            await idem.EndAsync();
        }
    }


    /* ----------------- helpers ----------------- */

    /* reserve 20:00 4 Dana   OR   reserve 2025-10-08 20:00 4 Dana */
    //static bool TryParseReservation(string raw, out (DateTimeOffset when, int party, string name) resv)
    //{
    //    var m = Regex.Match(raw, @"reserve\s+((?:\d{4}-\d{2}-\d{2}\s+)?\d{1,2}:\d{2})\s+(\d+)\s+(.+)$", RegexOptions.IgnoreCase);
    //    if (m.Success)
    //    {
    //        var whenStr = m.Groups[1].Value;
    //        var when = DateTimeOffset.TryParse(whenStr, out var dt)
    //            ? dt
    //            : DateTimeOffset.Parse($"{DateTimeOffset.Now:yyyy-MM-dd} {whenStr}");
    //        resv = (when, int.Parse(m.Groups[2].Value), m.Groups[3].Value.Trim());
    //        return true;
    //    }
    //    resv = default;
    //    return false;
    //}

    
    //static async Task<string> HandleReservation(NpgsqlDataSource db, Guid? workerId, (DateTimeOffset when, int party, string name) resv)
    //{
    //    await using var c = db.CreateCommand(
    //        "insert into reservations(reservation_id,name,party_size,starts_at,created_by_worker) values ($1,$2,$3,$4,$5)");
    //    c.Parameters.AddWithValue(Guid.NewGuid());
    //    c.Parameters.AddWithValue(resv.name);
    //    c.Parameters.AddWithValue(resv.party);
    //    c.Parameters.AddWithValue(resv.when);
    //    c.Parameters.AddWithValue((object?)workerId ?? DBNull.Value);
    //    await c.ExecuteNonQueryAsync();
    //    return $"✅ Reserved {resv.party} for {resv.name} at {resv.when:yyyy-MM-dd HH:mm}.";
    //}

    //static async Task<string> RenderMenu(NpgsqlDataSource db)
    //{
    //    await using var c = db.CreateCommand("select name, price, coalesce(category,'') from products order by category nulls last, name");
    //    await using var r = await c.ExecuteReaderAsync();
    //    var lines = new List<string>();
    //    while (await r.ReadAsync())
    //    {
    //        var cat = r.GetString(2);
    //        var line = string.IsNullOrEmpty(cat)
    //            ? string.Format("{0} — {1:0.##}", r.GetString(0), r.GetDecimal(1))
    //            : string.Format("{0} — {1:0.##} ({2})", r.GetString(0), r.GetDecimal(1), cat);
    //        lines.Add(line);
    //    }
    //    return (lines.Count == 0) ? "No items yet." : string.Join("\n", lines);
    //}
}
