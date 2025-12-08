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
    /// Manage lists (e.g. Names / Tables).
    /// Uses:
    ///   GET  /api/lists                         -> get all lists
    ///   POST /api/lists { title, listType }     -> create a list
    ///   GET  /api/stations/{stationId}/lists    -> lists attached to a station
    /// </summary>
    public sealed class ListsTool : ILlmTool
    {
        public string Name => "lists_control";

        public string Description =>
            "Create and fetch guest or table lists. " +
            "Use this when the user wants to see existing lists or create a new list.";

        private static readonly BinaryData _schema = BinaryData.FromString("""
        {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "description": "What to do with lists",
              "enum": ["get_all", "create", "get_for_station"]
            },
            "title": {
              "type": "string",
              "description": "Title of a new list, e.g. 'Friday waitlist'"
            },
            "listType": {
              "type": "string",
              "description": "Type of list. Currently 'Tables' or 'Names'.",
              "enum": ["Tables", "Names"]
            },
            "stationId": {
              "type": "string",
              "description": "Optional station id to fetch lists for that station"
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
                    case "get_all":
                        return await HandleGetAllAsync(http, ct);

                    case "create":
                        {
                            var title = args.TryGetProperty("title", out var t) ? t.GetString() : null;
                            var listType = args.TryGetProperty("listType", out var lt) ? lt.GetString() : null;
                            return await HandleCreateAsync(http, title, listType, ct);
                        }

                    case "get_for_station":
                        {
                            var stationId = args.TryGetProperty("stationId", out var s) ? s.GetString() : null;
                            return await HandleGetForStationAsync(http, stationId, ct);
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

        private static async Task<string> HandleGetAllAsync(HttpClient http, CancellationToken ct)
        {
            using var resp = await http.GetAsync("/api/lists", ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "get_all",
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "get_all",
                lists = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }

        private static async Task<string> HandleCreateAsync(HttpClient http, string? title, string? listType, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(listType))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "missing_fields",
                    detail = "Both 'title' and 'listType' are required to create a list."
                });
            }

            var payload = new
            {
                title,
                listType
            };

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var resp = await http.PostAsync("/api/lists", content, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "create",
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "create",
                list = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }

        private static async Task<string> HandleGetForStationAsync(HttpClient http, string? stationId, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(stationId))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "missing_station_id",
                    detail = "stationId is required for get_for_station."
                });
            }

            var path = $"/api/stations/{stationId}/lists";
            using var resp = await http.GetAsync(path, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "get_for_station",
                    stationId,
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "get_for_station",
                stationId,
                lists = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }
    }
}
