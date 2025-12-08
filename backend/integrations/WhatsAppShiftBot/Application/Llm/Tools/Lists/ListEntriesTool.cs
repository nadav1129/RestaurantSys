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
    /// Manage entries inside a list (e.g. waitlist names).
    /// Uses:
    ///   GET    /api/lists/{listId}/entries
    ///   POST   /api/lists/{listId}/entries
    ///   DELETE /api/lists/{listId}/entries/{entryId}
    /// </summary>
    public sealed class ListEntriesTool : ILlmTool
    {
        public string Name => "list_entries_control";

        public string Description =>
            "Add or remove entries (guests, tables) in a specific list, " +
            "or fetch all entries for a list.";

        private static readonly BinaryData _schema = BinaryData.FromString("""
        {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "description": "What to do with list entries",
              "enum": ["get_entries", "add_entry", "remove_entry"]
            },
            "listId": {
              "type": "string",
              "description": "The id of the list to work with"
            },
            "entryId": {
              "type": "string",
              "description": "The id of the entry (for remove_entry)"
            },
            "name": {
              "type": "string",
              "description": "Guest / entry name"
            },
            "phone": {
              "type": "string",
              "description": "Optional phone number of the guest"
            },
            "note": {
              "type": "string",
              "description": "Optional note or comment"
            },
            "numPeople": {
              "type": "integer",
              "description": "Optional number of people in the party"
            },
            "startTime": {
              "type": "string",
              "description": "Optional start time HH:MM"
            },
            "endTime": {
              "type": "string",
              "description": "Optional end time HH:MM"
            },
            "minutes": {
              "type": "integer",
              "description": "Optional duration in minutes"
            }
          },
          "required": ["action", "listId"]
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
            var listId = args.TryGetProperty("listId", out var l) ? l.GetString() : null;

            if (string.IsNullOrWhiteSpace(action) || string.IsNullOrWhiteSpace(listId))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "missing_required",
                    detail = "Both 'action' and 'listId' are required."
                });
            }

            try
            {
                switch (action)
                {
                    case "get_entries":
                        return await HandleGetEntriesAsync(http, listId, ct);

                    case "add_entry":
                        {
                            var name = args.TryGetProperty("name", out var n) ? n.GetString() : null;
                            var phone = args.TryGetProperty("phone", out var p) ? p.GetString() : null;
                            var note = args.TryGetProperty("note", out var no) ? no.GetString() : null;
                            int? numPeople = null;
                            if (args.TryGetProperty("numPeople", out var np) && np.ValueKind == JsonValueKind.Number)
                                numPeople = np.GetInt32();

                            var start = args.TryGetProperty("startTime", out var st) ? st.GetString() : null;
                            var end = args.TryGetProperty("endTime", out var et) ? et.GetString() : null;
                            int? minutes = null;
                            if (args.TryGetProperty("minutes", out var m) && m.ValueKind == JsonValueKind.Number)
                                minutes = m.GetInt32();

                            return await HandleAddEntryAsync(http, listId, name, phone, note, numPeople, start, end, minutes, ct);
                        }

                    case "remove_entry":
                        {
                            var entryId = args.TryGetProperty("entryId", out var e) ? e.GetString() : null;
                            return await HandleRemoveEntryAsync(http, listId, entryId, ct);
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

        private static async Task<string> HandleGetEntriesAsync(HttpClient http, string listId, CancellationToken ct)
        {
            var path = $"/api/lists/{listId}/entries";
            using var resp = await http.GetAsync(path, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "get_entries",
                    listId,
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "get_entries",
                listId,
                entries = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }

        private static async Task<string> HandleAddEntryAsync(
            HttpClient http,
            string listId,
            string? name,
            string? phone,
            string? note,
            int? numPeople,
            string? start,
            string? end,
            int? minutes,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "missing_name",
                    detail = "Name is required to add an entry."
                });
            }

            var payload = new
            {
                name,
                phone,
                note,
                numPeople,
                startTime = start,
                endTime = end,
                minutes
            };

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            var path = $"/api/lists/{listId}/entries";
            using var resp = await http.PostAsync(path, content, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "add_entry",
                    listId,
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "add_entry",
                listId,
                entry = JsonSerializer.Deserialize<JsonElement>(body)
            });
        }

        private static async Task<string> HandleRemoveEntryAsync(HttpClient http, string listId, string? entryId, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(entryId))
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "missing_entry_id",
                    detail = "entryId is required to remove an entry."
                });
            }

            var path = $"/api/lists/{listId}/entries/{entryId}";
            using var resp = await http.DeleteAsync(path, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode &&
                resp.StatusCode != System.Net.HttpStatusCode.NoContent)
            {
                return JsonSerializer.Serialize(new
                {
                    ok = false,
                    error = "api_error",
                    action = "remove_entry",
                    listId,
                    entryId,
                    status = (int)resp.StatusCode,
                    body
                });
            }

            return JsonSerializer.Serialize(new
            {
                ok = true,
                action = "remove_entry",
                listId,
                entryId
            });
        }
    }
}
