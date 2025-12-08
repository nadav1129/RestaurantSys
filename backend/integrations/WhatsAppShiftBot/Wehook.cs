#nullable enable

using Microsoft.Extensions.Logging;
using Npgsql;
using OpenAI.Chat;
using System.Text.Json;
using WhatsAppWebhook.Application.Commands;

var builder = WebApplication.CreateBuilder(args);

/* -------------------------------------------------
 * Configuration
 * ------------------------------------------------- */
var connString =
    builder.Configuration.GetConnectionString("AppDb")
    ?? builder.Configuration["DB"]
    ?? builder.Configuration["POSTGRES_CONNECTION"]
    ?? builder.Configuration["POSTGRES_CONNECTION_STRING"]
    ?? "Host=localhost;Username=postgres;Password=postgres;Database=restaurantsys";

/* -------------------------------------------------
 * Services (DI)
 * ------------------------------------------------- */
builder.Services.AddSingleton<Npgsql.NpgsqlDataSource>(_ =>
    Npgsql.NpgsqlDataSource.Create(connString));
builder.Services.AddHttpClient();

builder.Services.AddSingleton<IIdempotencyStore, PgIdempotencyStore>();

/* LLM brain that will call your ManagementApi via tool-calling.
 * Make sure you added LlmOrchestrator.cs to the project. */
builder.Services.AddSingleton<LlmOrchestrator>();

builder.Services.AddSingleton(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var apiKey = cfg["OpenAI:ApiKey"];
    if (string.IsNullOrWhiteSpace(apiKey))
        throw new InvalidOperationException("OpenAI:ApiKey is not configured.");

    // pick your model
    var model = cfg["OpenAI:Model"] ?? "gpt-4.1-mini";

    return new ChatClient(model, apiKey);
});

// LlmToolRegistry (whatever your implementation is)
builder.Services.AddSingleton<LlmToolRegistry>();


/* ============ Route register ============ */
// Shift
builder.Services.AddLlmToolsFromAssembly(typeof(ShiftControlTool).Assembly);


var app = builder.Build();

/* -------------------------------------------------
 * Health
 * ------------------------------------------------- */
app.MapGet("/", () => Results.Text("WhatsApp webhook is up.", "text/plain"));

/* -------------------------------------------------
 * Twilio: quick manual test endpoint (form-encoded echo)
 * ------------------------------------------------- */
app.MapPost("/twilio/adapter-test", async (HttpRequest req) =>
{
    if (!req.HasFormContentType)
    {
        const string bad = "<?xml version=\"1.0\"?><Response><Message>Bad content type</Message></Response>";
        return Results.Content(bad, "text/xml");
    }

    var form = await req.ReadFormAsync();
    var echo = form["Body"].ToString();

    var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>"
              + System.Security.SecurityElement.Escape($"Echo: {echo}")
              + "</Message></Response>";
    return Results.Content(xml, "text/xml");
});

app.MapGet("/twilio/adapter-test", () =>
    Results.Text("adapter-test GET alive", "text/plain"));
/* -------------------------------------------------
 * Twilio → WhatsApp inbound
 * ------------------------------------------------- */
app.MapPost("/twilio/adapter", async (
    HttpRequest req,
    ILoggerFactory lf,
    IIdempotencyStore idem,
    LlmOrchestrator llm) =>
{
    var log = lf.CreateLogger("TwilioAdapter");

    log.LogInformation("=== Twilio /twilio/adapter HIT === ContentType={ContentType}", req.ContentType);

    try
    {
        if (!req.HasFormContentType)
        {
            log.LogWarning("Twilio request does NOT have form content type. ContentType={ContentType}", req.ContentType);

            const string bad = "<?xml version=\"1.0\"?><Response><Message>Bad content type</Message></Response>";
            return Results.Content(bad, "text/xml");
        }

        var form = await req.ReadFormAsync();

        log.LogInformation("Twilio form keys: {Keys}", string.Join(", ", form.Keys));

        var messageId = form["MessageSid"].ToString();
        var from = form["From"].ToString();         /* e.g. 'whatsapp:+9725...' */
        var body = form["Body"].ToString() ?? string.Empty;

        log.LogInformation("Incoming Twilio message: MessageSid={MessageSid}, From={From}, Body={Body}",
            messageId, from, body);

        var fromE164 = from.StartsWith("whatsapp:", StringComparison.OrdinalIgnoreCase)
            ? from.Substring("whatsapp:".Length)
            : from;

        if (string.IsNullOrWhiteSpace(messageId))
        {
            messageId = $"{fromE164}|{body}|{DateTimeOffset.UtcNow:yyyyMMddHHmm}";
            log.LogWarning("MessageSid was empty, generated fallback messageId={MessageId}", messageId);
        }

        /* Idempotency */
        var isNew = await idem.TryBeginAsync(messageId);
        log.LogInformation("Idempotency check for {MessageId}: isNew={IsNew}", messageId, isNew);

        if (!isNew)
        {
            const string xmlDup = "<?xml version=\"1.0\"?><Response><Message>Already processed.</Message></Response>";
            log.LogInformation("Duplicate message detected, returning Already processed TwiML.");
            return Results.Content(xmlDup, "text/xml");
        }

        string reply;
        try
        {
            log.LogInformation("Calling LlmOrchestrator for from={FromE164}", fromE164);
            reply = await llm.HandleInboundAsync(fromE164, body, req.HttpContext.RequestAborted);
            log.LogInformation("LlmOrchestrator reply: {Reply}", reply);
        }
        finally
        {
            await idem.EndAsync();
            log.LogInformation("Idempotency.EndAsync() called for {MessageId}", messageId);
        }

        var xmlOk = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>"
                    + System.Security.SecurityElement.Escape(reply)
                    + "</Message></Response>";

        log.LogInformation("Sending TwiML response back to Twilio.");
        return Results.Content(xmlOk, "text/xml");
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Twilio adapter error");
        const string xmlErr = "<?xml version=\"1.0\"?><Response><Message>Server error</Message></Response>";
        return Results.Content(xmlErr, "text/xml");
    }
});


/* -------------------------------------------------
 * Meta (WhatsApp Cloud API) verification (GET)
 * Set WhatsApp:VerifyToken in config if you want to verify.
 * ------------------------------------------------- */
app.MapGet("/webhook/whatsapp", (HttpRequest req) =>
{
    var mode = req.Query["hub.mode"].ToString();
    var token = req.Query["hub.verify_token"].ToString();
    var challenge = req.Query["hub.challenge"].ToString();

    var expected = builder.Configuration["WhatsApp:VerifyToken"];
    if (mode == "subscribe" && !string.IsNullOrEmpty(challenge) && (string.IsNullOrEmpty(expected) || token == expected))
    {
        return Results.Text(challenge, "text/plain");
    }

    return Results.Unauthorized();
});

/* -------------------------------------------------
 * Meta (WhatsApp Cloud API) inbound (POST JSON)
 * ------------------------------------------------- */
app.MapPost("/webhook/whatsapp", async (
    HttpRequest req,
    ILoggerFactory lf,
    IIdempotencyStore idem,
    LlmOrchestrator llm) =>
{
    var log = lf.CreateLogger("MetaWebhook");

    try
    {
        using var doc = await JsonDocument.ParseAsync(req.Body);
        var root = doc.RootElement;

        /* Defensive parsing for WhatsApp Cloud API shape */
        var entry = root.TryGetProperty("entry", out var entries) && entries.GetArrayLength() > 0
            ? entries[0]
            : default;

        var change = entry.ValueKind != JsonValueKind.Undefined &&
                     entry.TryGetProperty("changes", out var changes) &&
                     changes.GetArrayLength() > 0
            ? changes[0]
            : default;

        var value = change.ValueKind != JsonValueKind.Undefined &&
                    change.TryGetProperty("value", out var v)
            ? v
            : default;

        var messages = value.ValueKind != JsonValueKind.Undefined &&
                       value.TryGetProperty("messages", out var msgs) &&
                       msgs.ValueKind == JsonValueKind.Array &&
                       msgs.GetArrayLength() > 0
            ? msgs[0]
            : default;

        if (messages.ValueKind == JsonValueKind.Undefined)
            return Results.Ok(); /* no message */

        var messageId = messages.TryGetProperty("id", out var mid) ? mid.GetString() ?? "" : "";
        var fromPhone = messages.TryGetProperty("from", out var fromEl) ? fromEl.GetString() ?? "" : "";
        var textBody = messages.TryGetProperty("text", out var t) && t.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "";

        if (!fromPhone.StartsWith("+") && fromPhone.Length > 0)
            fromPhone = "+" + fromPhone;

        if (string.IsNullOrWhiteSpace(messageId))
            messageId = $"{fromPhone}|{textBody}|{DateTimeOffset.UtcNow:yyyyMMddHHmm}";

        if (!await idem.TryBeginAsync(messageId))
            return Results.Text("Already processed.", "text/plain");

        string reply;
        try
        {
            reply = await llm.HandleInboundAsync(fromPhone, textBody, req.HttpContext.RequestAborted);
        }
        finally
        {
            await idem.EndAsync();
        }

        /* Your actual send-back is usually via Graph API call; returning 200 is enough here. */
        return Results.Text(reply, "text/plain");
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Meta webhook error");
        return Results.Problem("Server error");
    }
});

app.Run();

/* -------------------------------------------------
 * Notes:
 * - This file intentionally removes:
 *   - RuleBasedParser / IIntentParser registrations
 *   - CommandRouter registration
 *   - Any TipFormulaConfig usage
 * - Make sure LlmOrchestrator.cs exists and is registered above.
 * - PgIdempotencyStore.cs depends on NpgsqlDataSource from AddNpgsqlDataSource.
 * ------------------------------------------------- */
