#nullable enable
using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using OpenAI.Chat;

public interface ILlmTool
{
    string Name { get; }
    string Description { get; }
    public BinaryData ParametersSchema { get; }

    ChatTool ToChatTool() =>
        ChatTool.CreateFunctionTool(Name, Description, BinaryData.FromBytes(ParametersSchema.ToArray()));

    Task<string> ExecuteAsync(ChatToolCall call, HttpClient http, CancellationToken ct);
}
