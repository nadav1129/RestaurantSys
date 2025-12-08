#nullable enable
using System.Linq;
using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

public static class LlmServicesExtensions
{
    public static IServiceCollection AddLlmToolsFromAssembly(this IServiceCollection services, Assembly assembly)
    {
        var toolTypes = assembly
            .GetTypes()
            .Where(t => !t.IsAbstract && typeof(ILlmTool).IsAssignableFrom(t))
            .ToArray();

        foreach (var t in toolTypes)
            services.AddSingleton(typeof(ILlmTool), t);

        services.AddSingleton<LlmToolRegistry>();
        return services;
    }
}
