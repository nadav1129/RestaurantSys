#nullable enable
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using OpenAI.Chat;

/// <summary>
/// Tool for starting / ending / checking the active shift via ManagementApi /api/shifts endpoints.
/// </summary>
public sealed class ShiftControlTool : ILlmTool
{
    public string Name => "shift_control";

    public string Description =>
        "Start or end restaurant shifts and check the current active shift. " +
        "Use this when staff ask about starting a new shift, ending today's shift, or checking if a shift is already open.";

    // JSON Schema for the tool parameters, used by ChatTool.CreateFunctionTool
    public BinaryData ParametersSchema { get; } = BinaryData.FromString("""
    {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "description": "What to do with the shift.",
          "enum": [ "get_active", "start", "end" ]
        },
        "name": {
          "type": "string",
          "description": "Optional name for the shift when starting it (e.g. 'Evening shift')."
        }
      },
      "required": [ "action" ]
    }
    """);

    public async Task<string> ExecuteAsync(ChatToolCall call, HttpClient http, CancellationToken ct)
    {
        using var argsDoc = JsonDocument.Parse(call.FunctionArguments);
        var root = argsDoc.RootElement;

        if (!root.TryGetProperty("action", out var actionProp) ||
            actionProp.ValueKind != JsonValueKind.String)
        {
            return JsonSerializer.Serialize(new
            {
                ok = false,
                error = "missing_or_invalid_action"
            });
        }

        var action = actionProp.GetString() ?? string.Empty;
        action = action.Trim().ToLowerInvariant();

        try
        {
            switch (action)
            {
                case "get_active":
                    return await HandleGetActiveAsync(http, ct);

                case "start":
                    return await HandleStartAsync(root, http, ct);

                case "end":
                    return await HandleEndAsync(http, ct);

                default:
                    return JsonSerializer.Serialize(new
                    {
                        ok = false,
                        error = "unknown_action",
                        action
                    });
            }
        }
        catch (Exception ex)
        {
            // Any unexpected error – bubble back to the model as a tool error payload.
            return JsonSerializer.Serialize(new
            {
                ok = false,
                error = "exception",
                detail = ex.Message
            });
        }
    }

    /* ==========================
       Internal helpers
       ========================== */

    private static async Task<string> HandleGetActiveAsync(HttpClient http, CancellationToken ct)
    {
        var resp = await http.GetAsync("/api/shifts/active", ct);
        var body = await resp.Content.ReadAsStringAsync(ct);

        return JsonSerializer.Serialize(new
        {
            ok = resp.IsSuccessStatusCode,
            statusCode = (int)resp.StatusCode,
            body
        });
    }

    private static async Task<string> HandleStartAsync(JsonElement root, HttpClient http, CancellationToken ct)
    {
        string? name = null;
        if (root.TryGetProperty("name", out var nameProp) &&
            nameProp.ValueKind == JsonValueKind.String)
        {
            var n = nameProp.GetString();
            if (!string.IsNullOrWhiteSpace(n))
                name = n.Trim();
        }

        var payload = JsonSerializer.Serialize(new { name });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var resp = await http.PostAsync("/api/shifts", content, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);

        return JsonSerializer.Serialize(new
        {
            ok = resp.IsSuccessStatusCode,
            statusCode = (int)resp.StatusCode,
            body
        });
    }

    private static async Task<string> HandleEndAsync(HttpClient http, CancellationToken ct)
    {
        // 1) Get the active shift to know which ID to close
        var activeResp = await http.GetAsync("/api/shifts/active", ct);
        var activeBody = await activeResp.Content.ReadAsStringAsync(ct);

        if (!activeResp.IsSuccessStatusCode)
        {
            return JsonSerializer.Serialize(new
            {
                ok = false,
                error = "failed_to_fetch_active_shift",
                statusCode = (int)activeResp.StatusCode,
                body = activeBody
            });
        }

        Guid shiftId;
        using (var activeDoc = JsonDocument.Parse(activeBody))
        {
            var root = activeDoc.RootElement;

            // When there is no active shift, the endpoint returns JSON null.
            if (root.ValueKind == JsonValueKind.Null ||
                root.ValueKind == JsonValueKind.Undefined)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "no_active_shift"
                });
            }

            if (!root.TryGetProperty("shiftId", out var idProp) ||
                idProp.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(idProp.GetString(), out shiftId))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "invalid_active_shift_payload",
                    body = activeBody
                });
            }
        }

        // 2) Close that shift
        var closeUrl = $"/api/shifts/{shiftId}/close";
        var closeResp = await http.PostAsync(closeUrl, content: null, ct);
        var closeBody = await closeResp.Content.ReadAsStringAsync(ct);

        return JsonSerializer.Serialize(new
        {
            ok = closeResp.IsSuccessStatusCode,
            statusCode = (int)closeResp.StatusCode,
            body = closeBody
        });
    }
}
