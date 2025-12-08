#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using OpenAI.Chat;

public sealed class LlmToolRegistry
{
    private readonly IReadOnlyDictionary<string, ILlmTool> _byName;
    public IReadOnlyList<ChatTool> ChatTools { get; }

    public LlmToolRegistry(IEnumerable<ILlmTool> tools)
    {
        var dict = new Dictionary<string, ILlmTool>(StringComparer.Ordinal);
        foreach (var t in tools)
            dict[t.Name] = t;
        _byName = dict;
        ChatTools = tools.Select(t => t.ToChatTool()).ToArray();
    }

    public bool TryGet(string name, out ILlmTool tool) => _byName.TryGetValue(name, out tool!);
}
