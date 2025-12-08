#nullable enable
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;

public sealed class LlmOrchestrator
{
    private readonly ILogger<LlmOrchestrator> _log;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ChatClient _chat;
    private readonly string _apiBase;
    private readonly LlmToolRegistry _registry;

    public LlmOrchestrator(
        ILogger<LlmOrchestrator> log,
        IHttpClientFactory httpFactory,
        ChatClient chat,
        IConfiguration cfg,
        LlmToolRegistry registry)
    {
        _log = log;
        _httpFactory = httpFactory;
        _chat = chat;
        _apiBase = cfg["ManagementApi:BaseUrl"] ?? "http://localhost:8080";
        _registry = registry;
    }

    public async Task<string> HandleInboundAsync(string fromE164, string text, CancellationToken ct = default)
    {
        var systemPrompt = """
You are the RestaurantSys assistant for staff chatting via WhatsApp.
Your ONLY job is to help staff manage the restaurant system,
mostly by calling the available tools (like shift_control).

Language rules:
- If the user writes in Hebrew, answer ONLY in Hebrew.
- Otherwise, answer in clear, simple English.
- NEVER answer in Arabic, Russian, or any other language.
- Do not mix languages in one message.
- If the user explicitly asks you not to use a language, strictly obey.

Shift behavior:
- The main tool to control shifts is `shift_control`.
- When the user says things like:
  - "start shift", "open a new shift", "תתחיל משמרת", "פתח משמרת"
    → call `shift_control` with { action: "start" }.
  - "start shift X", "shift name is X", "תתחיל משמרת X"
    → call `shift_control` with { action: "start", name: "X" }.
    Treat ANY short phrase after that as the shift name. Do NOT ask for clarification,
    just use it as-is.
  - "end shift", "close shift", "סיים משמרת", "סגור משמרת"
    → call `shift_control` with { action: "end" } and let the tool pick the active shift.
  - "which shift is active", "איזו משמרת פתוחה"
    → call `shift_control` with { action: "get_active" }.

    Lists behavior:
- When the user wants to see their lists (e.g. "show my lists", "הצג רשימות"),
  call lists_control with { action: "get_all" }.
- When they want to create a list (e.g. "create a waitlist called Friday",
  "תיצור רשימת שמות שישי"), call lists_control with
  { action: "create", title: "...", listType: "Names" }.
- If they mention tables list, use listType "Tables".

List entries behavior:
- To add a person to a list (e.g. "add Nadav to Friday waitlist, 4 people at 20:30"),
  first figure out the listId (by name if you know it from context) and then call
  list_entries_control with { action: "add_entry", listId, name, numPeople, startTime }.
- To remove someone from a list ("remove Nadav from Friday waitlist"), use
  list_entries_control with { action: "remove_entry", listId, entryId } once you know entryId.

Settings behavior:
- For requests like "set active menu to 2", "set discount to 10%", use settings_control
  with { action: "update_settings", activeMenuNum: 2 } or { action: "update_settings", globalDiscountPct: 10 }.
- To report current menu / discount, use settings_control with { action: "get_settings" }.


- Prefer calling tools over asking clarification.
- Only ask follow-up questions if the user’s intent is truly unclear or contradictory.

Answer style:
- Be short and direct: 1–2 sentences.
- Summarize what you did, e.g. "פתחתי משמרת בשם 'friday nati'."
- If a tool returns an error (e.g. no active shift), explain it simply and
  suggest the next step.
""";

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(text)
        };

        var options = new ChatCompletionOptions{Temperature = 0.2f};
        foreach (var t in _registry.ChatTools)
            options.Tools.Add(t);

        var http = _httpFactory.CreateClient();
        http.BaseAddress = new Uri(_apiBase);

        while (true)
        {
            // NEW: result wrapper + .Value
            var result = await _chat.CompleteChatAsync(messages, options, ct);
            ChatCompletion completion = result.Value;   // ✅ unwrap

            if (completion.FinishReason == ChatFinishReason.Stop)
            {
                var final = completion.Content.Count > 0
                    ? completion.Content[0].Text
                    : "(no content)";

                messages.Add(new AssistantChatMessage(completion));
                return final ?? "בוצע.";
            }

            if (completion.FinishReason == ChatFinishReason.ToolCalls &&
                completion.ToolCalls is { Count: > 0 })
            {
                messages.Add(new AssistantChatMessage(completion));

                foreach (var call in completion.ToolCalls)
                {
                    string toolResultJson;

                    if (_registry.TryGet(call.FunctionName, out var tool))
                    {
                        try
                        {
                            toolResultJson = await tool.ExecuteAsync(call, http, ct);
                        }
                        catch (Exception ex)
                        {
                            _log.LogError(ex, "Tool {Tool} failed", call.FunctionName);
                            toolResultJson = JsonSerializer.Serialize(new
                            {
                                error = "tool_failed",
                                detail = ex.Message
                            });
                        }
                    }
                    else
                    {
                        toolResultJson = JsonSerializer.Serialize(new
                        {
                            error = "unknown_tool",
                            name = call.FunctionName
                        });
                    }

                    messages.Add(new ToolChatMessage(call.Id, toolResultJson));
                }

                // Let the model read the tool results and finish
                continue;
            }

            // Fallback if finish reason is something else (length, content filter, etc.)
            var safeText = completion.Content.Count > 0
                ? completion.Content[0].Text
                : "לא הצלחתי להבין. נסו שוב.";

            return safeText ?? "לא הצלחתי להבין. נסו שוב.";
        }
    }
}
