using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this WebApplication app)
    {
        // ===== SETTINGS =====
        // GET /api/settings
        app.MapGet("/api/settings", async (NpgsqlDataSource db) =>
        {
            const string getSql = @"
        select active_menu_num, global_discount_pct
        from public.management_settings
        where id = 1;
    ";

            await using var cmd = db.CreateCommand(getSql);
            await using var r = await cmd.ExecuteReaderAsync();
            if (await r.ReadAsync())
            {
                return Results.Json(new ManagementSettingsDto
                {
                    ActiveMenuNum = r.IsDBNull(0) ? (int?)null : r.GetInt32(0),
                    GlobalDiscountPct = r.GetDecimal(1)
                });
            }

            // If row missing (first run), create it and return defaults
            const string seedSql = "insert into public.management_settings(id) values (1);";
            await using (var seed = db.CreateCommand(seedSql)) { await seed.ExecuteNonQueryAsync(); }

            return Results.Json(new ManagementSettingsDto
            {
                ActiveMenuNum = null,
                GlobalDiscountPct = 0m
            });
        });

        // PUT /api/settings
        app.MapPut("/api/settings", async (UpdateManagementSettingsRequest payload, NpgsqlDataSource db) =>
        {
            if (payload is null) return Results.BadRequest(new { error = "Invalid JSON." });

            // Validate discount if provided
            if (payload.GlobalDiscountPct is decimal d && (d < 0 || d > 100))
                return Results.BadRequest(new { error = "globalDiscountPct must be between 0 and 100." });

            // If ActiveMenuNum provided, ensure the menu exists
            if (payload.ActiveMenuNum is int m && m > 0)
            {
                const string existsSql = "select 1 from public.menus where menu_num = @m limit 1;";
                await using var ex = db.CreateCommand(existsSql);
                ex.Parameters.AddWithValue("@m", NpgsqlTypes.NpgsqlDbType.Integer, m);
                var ok = await ex.ExecuteScalarAsync();
                if (ok is null) return Results.BadRequest(new { error = "ActiveMenuNum does not exist." });
            }

            // Ensure singleton row exists
            const string ensureSql = "insert into public.management_settings(id) values (1) on conflict (id) do nothing;";
            await using (var ens = db.CreateCommand(ensureSql)) { await ens.ExecuteNonQueryAsync(); }

            // Build a partial update
            var setParts = new List<string>();
            if (payload.ActiveMenuNum is null)
                setParts.Add("active_menu_num = null");
            else if (payload.ActiveMenuNum is int)
                setParts.Add("active_menu_num = @active");
            if (payload.GlobalDiscountPct is decimal)
                setParts.Add("global_discount_pct = @disc");

            if (setParts.Count == 0)
                return Results.BadRequest(new { error = "Nothing to update." });

            var sql = $@"
        update public.management_settings
           set {string.Join(", ", setParts)},
               updated_at = now()
         where id = 1
     returning active_menu_num, global_discount_pct;
    ";

            await using var cmd = db.CreateCommand(sql);
            if (payload.ActiveMenuNum is int am)
                cmd.Parameters.AddWithValue("@active", NpgsqlTypes.NpgsqlDbType.Integer, am);
            if (payload.GlobalDiscountPct is decimal gd)
                cmd.Parameters.AddWithValue("@disc", NpgsqlTypes.NpgsqlDbType.Numeric, gd);

            await using var r = await cmd.ExecuteReaderAsync();
            await r.ReadAsync();

            var dto = new ManagementSettingsDto
            {
                ActiveMenuNum = r.IsDBNull(0) ? (int?)null : r.GetInt32(0),
                GlobalDiscountPct = r.GetDecimal(1)
            };
            return Results.Json(dto);
        });

        // GET /api/settings/active-menu
        app.MapGet("/api/settings/active-menu", async (NpgsqlDataSource db) =>
        {
            const string sql = "select active_menu_num from public.management_settings where id = 1;";
            await using var cmd = db.CreateCommand(sql);
            var o = await cmd.ExecuteScalarAsync();
            return Results.Json(new { activeMenuNum = o is DBNull or null ? (int?)null : Convert.ToInt32(o) });
        });
    }
}
