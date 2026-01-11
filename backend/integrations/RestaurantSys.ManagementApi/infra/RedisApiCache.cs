#nullable enable

using Microsoft.EntityFrameworkCore.Storage;
using StackExchange.Redis;
using System.Text;
using System.Text.Json;

namespace RestaurantSys.Infrastructure.Caching;

/* Defines one cache "thing" (Menus list, Ingredients list, MenuById, etc.) */
public sealed record CacheDef<T>(
    string Prefix,
    TimeSpan Ttl,
    JsonSerializerOptions? JsonOptions = null
);

public sealed class RedisApiCache
{
    private readonly StackExchange.Redis.IDatabase _db;

    public RedisApiCache(IConnectionMultiplexer mux)
    {
        _db = mux.GetDatabase();
    }

    /* =========================
       Public API
       ========================= */

    /* Cache-aside: read cache, otherwise compute, store, return */
    public async Task<T> GetOrCreateAsync<T>(
        CacheDef<T> def,
        string keySuffix,
        Func<Task<T>> factory,
        CancellationToken ct = default
    )
    {
        var key = await BuildVersionedKey(def.Prefix, keySuffix);
        var cached = await _db.StringGetAsync(key);

        if (cached.HasValue)
            return Deserialize<T>(cached!, def.JsonOptions);

        ct.ThrowIfCancellationRequested();

        var value = await factory();

        var payload = Serialize(value, def.JsonOptions);
        await _db.StringSetAsync(key, payload, def.Ttl);

        return value;
    }

    /* Explicit set (rarely needed if you use GetOrCreateAsync) */
    public async Task SetAsync<T>(
        CacheDef<T> def,
        string keySuffix,
        T value
    )
    {
        var key = await BuildVersionedKey(def.Prefix, keySuffix);
        var payload = Serialize(value, def.JsonOptions);
        await _db.StringSetAsync(key, payload, def.Ttl);
    }

    /* Remove one cached entry */
    public async Task RemoveAsync(string fullRedisKey)
    {
        await _db.KeyDeleteAsync(fullRedisKey);
    }

    /*
      Invalidate the ENTIRE group (Menus, Ingredients, etc.)
      by bumping a version number stored in Redis.

      Any old keys become unreachable automatically.
    */
    public async Task InvalidateAsync(string prefix)
    {
        await _db.StringIncrementAsync(VersionKey(prefix));
    }

    public async Task InvalidateAsync<T>(CacheDef<T> def)
    {
        await InvalidateAsync(def.Prefix);
    }

    /* If you ever need the actual final redis key (for debugging) */
    public async Task<string> GetCurrentVersionedKey(string prefix, string keySuffix)
    {
        return await BuildVersionedKey(prefix, keySuffix);
    }

    /* =========================
       Internals
       ========================= */

    private static string VersionKey(string prefix) => $"cachever:{prefix}";

    private async Task<long> GetVersion(string prefix)
    {
        var v = await _db.StringGetAsync(VersionKey(prefix));
        if (!v.HasValue) return 0;

        if (long.TryParse(v.ToString(), out var parsed))
            return parsed;

        return 0;
    }

    private async Task<string> BuildVersionedKey(string prefix, string keySuffix)
    {
        var ver = await GetVersion(prefix);
        /* Example: api:menus:v3:list  */
        return $"{prefix}:v{ver}:{keySuffix}";
    }

    private static byte[] Serialize<T>(T value, JsonSerializerOptions? opts)
    {
        return JsonSerializer.SerializeToUtf8Bytes(value, opts);
    }

    private static T Deserialize<T>(RedisValue data, JsonSerializerOptions? opts)
    {
        /* RedisValue -> byte[] */
        var bytes = (byte[])data!;
        return JsonSerializer.Deserialize<T>(bytes, opts)
            ?? throw new InvalidOperationException("Failed to deserialize cached payload.");
    }
}

/* =========================
   Static definitions (this is the part you meant)
   Put all your cache definitions here.
   ========================= */

public static class ApiCacheDefs
{
    /* Prefix naming: use something stable and consistent */
    public static readonly CacheDef<List<MenuListItemDto>> MenusList =
    new("api:menus", TimeSpan.FromMinutes(5));
}

/* DTO examples (replace with your real DTOs) */
public sealed record MenuListItemDto(Guid MenuId, int MenuNum, string Name);
public sealed record MenuDto(Guid MenuId, int MenuNum, string Name);
public sealed record IngredientDto(Guid IngredientId, string Name);
