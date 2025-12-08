#nullable enable
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using OpenAI.Chat;

namespace WhatsAppWebhook.Application.Commands
{
    /// <summary>
    /// Manage management_settings (active menu + global discount).
    /// Uses:
    ///   GET /api/settings
    ///   PUT /api/settings   { activeMenuNum?, globalDiscountPct? }
    ///   GET /api/settings/active-menu
    /// </summary>
    public sealed class SettingsTool : ILlmTool
    {
        public string Name => "settings_control";

        public string Description =>
            "View or change system settings like active menu and global discount percentage.";

        private static readonly BinaryData _schema = BinaryData.FromString("""
        {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "description": "What to do with settings",
              "enum": ["get_settings", "update_settings", "get_active_menu"]
            },
            "activeMenuNum": {
              "type": ["integer", "null"],
              "description": "Menu number to set as active. Use null to clear."
            },
            "globalDiscountPct": {
              "type": ["number", "null"],
              "description": "Discount percent 0-100. If omitted, keep existing."
            }
          },
          "required": ["action"]
        }
        """);

        public BinaryData ParametersSchema => _schema;

        public async Task<string> ExecuteAsync(ChatToolCall call, HttpClient http, CancellationToken ct)
        {
            JsonElement args;
            try
            {
                args = JsonSerializer.Deserialize<JsonElement>(call.FunctionArguments.ToString());
            }
            catch (Exception ex)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "bad_arguments",
                    detail = "Failed to parse arguments JSON: " + ex.Message
                });
            }

            var action = args.TryGetProperty("action", out var a) ? a.GetString() : null;
            if (string.IsNullOrWhiteSpace(action))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "missing_action",
                    detail = "The 'action' field is required."
                });
            }

            try
            {
                switch (action)
                {
                    case "get_settings":
                        return await HandleGetSettingsAsync(http, ct);

                    case "get_active_menu":
                        return await HandleGetActiveMenuAsync(http, ct);

                    case "update_settings":
                        {
                            int? activeMenuNum = null;
                            if (args.TryGetProperty("activeMenuNum", out var am) &&
                                am.ValueKind == JsonValueKind.Number)
                                activeMenuNum = am.GetInt32();
                            else if (args.TryGetProperty("activeMenuNum", out am) &&
                                     am.ValueKind == JsonValueKind.Null)
                                activeMenuNum = null; // explicit clear

                            decimal? globalDiscountPct = null;
                            if (args.TryGetProperty("globalDiscountPct", out var gd) &&
                                gd.ValueKind == JsonValueKind.Number)
                                globalDiscountPct = gd.GetDecimal();

                            return await HandleUpdateSettingsAsync(http, activeMenuNum, globalDiscountPct, ct);
                        }

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
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "exception",
                    detail = ex.Message
                });
            }
        }

        /* ================= helpers ================= */

        private static async Task<string> HandleGetSettingsAsync(HttpClient http, CancellationToken ct)
        {
            using var resp = await http.GetAsync("/api/settings", ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "get_settings",
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "get_settings",
                settings = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }

        private static async Task<string> HandleGetActiveMenuAsync(HttpClient http, CancellationToken ct)
        {
            using var resp = await http.GetAsync("/api/settings/active-menu", ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "get_active_menu",
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "get_active_menu",
                info = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }

        private static async Task<string> HandleUpdateSettingsAsync(
            HttpClient http,
            int? activeMenuNum,
            decimal? globalDiscountPct,
            CancellationToken ct)
        {
            if (activeMenuNum is null && globalDiscountPct is null)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "nothing_to_update",
                    detail = "Provide activeMenuNum and/or globalDiscountPct."
                });
            }

            var payload = new
            {
                ActiveMenuNum = activeMenuNum,
                GlobalDiscountPct = globalDiscountPct
            };

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var resp = await http.PutAsync("/api/settings", content, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "update_settings",
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "update_settings",
                settings = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }
    }
}
