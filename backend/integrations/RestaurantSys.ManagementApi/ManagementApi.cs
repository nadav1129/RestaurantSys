using System;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using RestaurantSys.Api; /* <- this is where DTOs live */

namespace RestaurantSys.Api
{
    public static class ManagementApi
    {
        public static void MapManagementApi(this WebApplication app)
        {
            // ===== MENUS (PARTITIONS) =====
            app.MapGet("/api/menus", async (NpgsqlDataSource db) =>
            {
                try
                {
                    const string sql = "select menu_num, name from public.menus order by menu_num;";
                    var list = new List<MenuDto>();
                    await using var cmd = db.CreateCommand(sql);
                    await using var r = await cmd.ExecuteReaderAsync();
                    while (await r.ReadAsync())
                        list.Add(new MenuDto { MenuNum = r.GetInt32(0), Name = r.GetString(1) });
                    return Results.Json(list);
                }
                catch (Exception ex) 
                {
                        Console.Error.WriteLine("Error in GET /api/menus:");
                        Console.Error.WriteLine(ex);
                        return Results.Problem($"GET /api/menus failed: {ex.Message}", statusCode: 500);
                }
            });

            app.MapPost("/api/menus", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                try
                {
                    var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                    string? requestedName = null;
                    if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("name", out var nameProp))
                        requestedName = (nameProp.GetString() ?? "").Trim();

                    // 1) Insert into menus -> returns new counter (n+1)
                    const string insMenu = @"insert into public.menus(name) values($1) returning menu_num, name;";
                    int newMenuNum; string menuName;
                    await using (var cmd = db.CreateCommand(insMenu))
                    {
                        cmd.Parameters.AddWithValue((object?)requestedName ?? DBNull.Value);
                        await using var r = await cmd.ExecuteReaderAsync();
                        await r.ReadAsync();
                        newMenuNum = r.GetInt32(0);
                        menuName = r.GetString(1);
                    }

                    return Results.Json(new { menuNum = newMenuNum, name = menuName });
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in POST /api/menus:");
                    Console.Error.WriteLine(ex);
                    return Results.Problem($"POST /api/menus failed: {ex.Message}", statusCode: 500);
                }
            });

            /* ========== MENU NODES (TREE) ========== */
            //app.MapGet("/api/menu-nodes", async (NpgsqlDataSource db) =>
            //{
            //    const string sql = @"
            //        select node_id, parent_id, name, is_leaf
            //        from menu_nodes;
            //    ";

            //    var flat = new List<MenuNodeDto>();

            //    await using (var cmd = db.CreateCommand(sql))
            //    await using (var reader = await cmd.ExecuteReaderAsync())
            //    {
            //        while (await reader.ReadAsync())
            //        {
            //            flat.Add(new MenuNodeDto
            //            {
            //                Id = reader.GetGuid(0),
            //                ParentId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1),
            //                Name = reader.GetString(2),
            //                IsLeaf = reader.GetBoolean(3),
            //                Children = new List<MenuNodeDto>()
            //            });
            //        }
            //    }

            //    // build hierarchy
            //    var byId = new Dictionary<Guid, MenuNodeDto>();
            //    foreach (var n in flat)
            //        byId[n.Id] = n;

            //    var roots = new List<MenuNodeDto>();
            //    foreach (var n in flat)
            //    {
            //        if (n.ParentId is Guid pid && byId.TryGetValue(pid, out var parent))
            //            parent.Children.Add(n);
            //        else
            //            roots.Add(n);
            //    }

            //    return Results.Json(roots);
            //});

            app.MapGet("/api/menu-nodes", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                try
                {
                    if (!int.TryParse(req.Query["menu"], out var menuNum))
                        return Results.BadRequest(new { error = "Missing or invalid ?menu= partition number" });

                    const string sql = """
    select
      node_id, parent_id, name, is_leaf, layer, sort_order, price_cents, menu_num
    from public.menu_nodes
    where menu_num = @m
    order by coalesce(parent_id,'00000000-0000-0000-0000-000000000000'), sort_order, name;
    """;

                    var all = new List<MenuNodeDto>();
                    await using (var cmd = db.CreateCommand(sql))
                    {
                        cmd.Parameters.AddWithValue("@m", NpgsqlTypes.NpgsqlDbType.Integer, menuNum);
                        await using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            all.Add(new MenuNodeDto
                            {
                                Id = reader.GetGuid(0),
                                ParentId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1),
                                Name = reader.GetString(2),
                                IsLeaf = reader.GetBoolean(3),
                                Layer = reader.GetInt32(4),
                                SortOrder = reader.GetInt32(5),
                                PriceCents = reader.IsDBNull(6) ? (int?)null : reader.GetInt32(6),
                                MenuNum = reader.GetInt32(7),
                                Children = new List<MenuNodeDto>()
                            });
                        }
                    }

                    var byId = all.ToDictionary(n => n.Id);
                    foreach (var n in all)
                        if (n.ParentId is Guid pid && byId.TryGetValue(pid, out var parent))
                            parent.Children.Add(n);

                    var root = all.FirstOrDefault(n => n.Layer == 0 && n.ParentId is null);
                    if (root is null) return Results.Ok(Array.Empty<MenuNodeDto>());

                    void SortRec(MenuNodeDto node)
                    {
                        node.Children = node.Children
                            .OrderBy(c => c.SortOrder)
                            .ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
                            .ToList();
                        foreach (var c in node.Children) SortRec(c);
                    }
                    SortRec(root);

                    return Results.Ok(root.Children);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in Get /api/menu-nodes:");
                    Console.Error.WriteLine(ex);
                    return Results.Problem($"Get /api/menu-nodes failed: {ex.Message}", statusCode: 500);
                }
            });



            app.MapPost("/api/menu-nodes", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                try
                {
                    var body = await JsonSerializer.DeserializeAsync<CreateMenuNodeRequest>(req.Body);
                    if (body is null) return Results.BadRequest(new { error = "Invalid JSON" });

                    var name = (body.Name ?? "").Trim();
                    if (name.Length == 0) return Results.BadRequest(new { error = "Name is required" });

                    Guid? effectiveParent = body.ParentId;
                    int parentLayer = -1;
                    int resolvedMenuNum;

                    // Case 1: parent provided -> inherit menu + calc layer
                    if (effectiveParent is Guid pid && pid != Guid.Empty)
                    {
                        const string parentSql = """
            select is_leaf, layer, menu_num
            from public.menu_nodes
            where node_id = @pid
        """;
                        await using (var meta = db.CreateCommand(parentSql))
                        {
                            meta.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, pid);
                            await using var r = await meta.ExecuteReaderAsync();
                            if (!await r.ReadAsync())
                                return Results.BadRequest(new { error = "Parent node does not exist." });

                            var parentIsLeaf = r.GetBoolean(0);
                            parentLayer = r.GetInt32(1);
                            resolvedMenuNum = r.GetInt32(2);

                            // Optional: prevent adding children under a leaf
                            if (parentIsLeaf && !body.IsLeaf)
                                return Results.BadRequest(new { error = "Cannot add a non-leaf under a leaf node." });
                        }
                    }
                    else
                    {
                        // Case 2: no parent -> require MenuNum and attach under that menu's root
                        if (body.MenuNum <= 0)
                            return Results.BadRequest(new { error = "MenuNum is required when ParentId is null." });

                        resolvedMenuNum = body.MenuNum;

                        const string rootSql = """
            select node_id, layer
            from public.menu_nodes
            where menu_num = @m and layer = 0 and parent_id is null
        """;
                        await using var rootCmd = db.CreateCommand(rootSql);
                        rootCmd.Parameters.AddWithValue("@m", NpgsqlTypes.NpgsqlDbType.Integer, resolvedMenuNum);
                        await using var rr = await rootCmd.ExecuteReaderAsync();

                        if (!await rr.ReadAsync())
                            return Results.BadRequest(new { error = "Root for requested menu not found. Create the menu first via POST /api/menus." });

                        var rootId = rr.GetGuid(0);
                        var rootLayer = rr.GetInt32(1);
                        if (await rr.ReadAsync())
                            return Results.BadRequest(new { error = "Multiple roots found for this menu (data integrity issue)." });

                        effectiveParent = rootId;   // attach under root
                        parentLayer = rootLayer;     // 0
                    }

                    var newLayer = parentLayer + 1;

                    // Next sort_order under this parent
                    const string nextOrderSql = """
        select coalesce(max(sort_order), -1) + 1
        from public.menu_nodes
        where parent_id is not distinct from @p
          and menu_num = @m
    """;
                    int nextOrder;
                    await using (var ordCmd = db.CreateCommand(nextOrderSql))
                    {
                        ordCmd.Parameters.AddWithValue("@p", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)effectiveParent ?? DBNull.Value);
                        ordCmd.Parameters.AddWithValue("@m", NpgsqlTypes.NpgsqlDbType.Integer, resolvedMenuNum);
                        nextOrder = (int)(await ordCmd.ExecuteScalarAsync() ?? 0);
                    }

                    // Insert the node
                    const string insertSql = """
        insert into public.menu_nodes
        (node_id, parent_id, name, is_leaf, price_cents, sort_order, layer, menu_num)
        values (@id, @parent, @name, @isleaf, @price, @ord, @layer, @menu)
        returning node_id, parent_id, name, is_leaf, price_cents, sort_order, layer, menu_num
    """;
                    var newId = Guid.NewGuid();
                    await using (var cmd = db.CreateCommand(insertSql))
                    {
                        cmd.Parameters.AddWithValue("@id", NpgsqlTypes.NpgsqlDbType.Uuid, newId);
                        cmd.Parameters.AddWithValue("@parent", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)effectiveParent ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@name", NpgsqlTypes.NpgsqlDbType.Text, name);
                        cmd.Parameters.AddWithValue("@isleaf", NpgsqlTypes.NpgsqlDbType.Boolean, body.IsLeaf);
                        cmd.Parameters.AddWithValue("@price", NpgsqlTypes.NpgsqlDbType.Integer, (object?)body.PriceCents ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@ord", NpgsqlTypes.NpgsqlDbType.Integer, nextOrder);
                        cmd.Parameters.AddWithValue("@layer", NpgsqlTypes.NpgsqlDbType.Integer, newLayer);
                        cmd.Parameters.AddWithValue("@menu", NpgsqlTypes.NpgsqlDbType.Integer, resolvedMenuNum);

                        await using var reader = await cmd.ExecuteReaderAsync();
                        await reader.ReadAsync();

                        var dto = new MenuNodeDto
                        {
                            Id = reader.GetGuid(0),
                            ParentId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1),
                            Name = reader.GetString(2),
                            IsLeaf = reader.GetBoolean(3),
                            PriceCents = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4),
                            SortOrder = reader.GetInt32(5),
                            Layer = reader.GetInt32(6),
                            MenuNum = reader.GetInt32(7),
                            Children = new List<MenuNodeDto>()
                        };

                        return Results.Json(dto);
                    }
                }
                catch (Exception ex) 
                {
                    Console.Error.WriteLine("Error in POST menu-nodes:");
                    Console.Error.WriteLine(ex);
                    return Results.Problem($"POST api/menu-nodes failed: {ex.Message}", statusCode: 500);
                }
            });

            /* ========== INGREDIENTS ========== */
            app.MapGet("/api/ingredients", async (NpgsqlDataSource db) =>
            {
                const string sql = @"
                    select ingredient_id, name
                    from ingredients
                    order by name;
                ";

                var list = new List<IngredientDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new IngredientDto
                    {
                        IngredientId = reader.GetGuid(0),
                        Name = reader.GetString(1)
                    });
                }

                return Results.Json(list);
            });

            /* ========== PRODUCTS (LIST/FILTER) ========== */
            app.MapGet("/api/products", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                var menuNodeIdStr = req.Query["menuNodeId"].ToString();
                var isBottleOnlyStr = req.Query["isBottleOnly"].ToString();

                // Case A: products under a specific leaf
                if (!string.IsNullOrWhiteSpace(menuNodeIdStr)
                    && Guid.TryParse(menuNodeIdStr, out var menuNodeId))
                {
                    const string sql = @"
                        select p.product_id, p.name, p.type, pr.price
                        from products p
                        left join product_prices pr on pr.product_id = p.product_id
                        where p.menu_node_id = $1
                        order by p.name;
                    ";

                    var list = new List<ProductListItemDto>();

                    await using var cmd = db.CreateCommand(sql);
                    cmd.Parameters.AddWithValue(menuNodeId);
                    await using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        list.Add(new ProductListItemDto
                        {
                            Id = reader.GetGuid(0),
                            Name = reader.GetString(1),
                            Type = reader.GetString(2),
                            Price = reader.IsDBNull(3) ? (decimal?)null : reader.GetDecimal(3)
                        });
                    }

                    return Results.Json(list);
                }

                // Case B: only bottle SKUs (Speed Rail dropdown)
                if (!string.IsNullOrWhiteSpace(isBottleOnlyStr)
                    && isBottleOnlyStr.Equals("true", StringComparison.OrdinalIgnoreCase))
                {
                    const string sql = @"
                        select p.product_id, p.name, p.type, pr.price
                        from products p
                        left join product_prices pr on pr.product_id = p.product_id
                        where p.type = 'Bottle'
                        order by p.name;
                    ";

                    var list = new List<ProductListItemDto>();

                    await using var cmd = db.CreateCommand(sql);
                    await using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        list.Add(new ProductListItemDto
                        {
                            Id = reader.GetGuid(0),
                            Name = reader.GetString(1),
                            Type = reader.GetString(2),
                            Price = reader.IsDBNull(3) ? (decimal?)null : reader.GetDecimal(3)
                        });
                    }

                    return Results.Json(list);
                }

                // fallback
                return Results.Json(Array.Empty<ProductListItemDto>());
            });

            /* ========== SPEED MAP GET ========== */
            app.MapGet("/api/speed-map", async (NpgsqlDataSource db) =>
            {
                const string sql = @"
                    select i.ingredient_id,
                           i.name as ingredient_name,
                           sm.bottle_product_id,
                           p.name as bottle_product_name
                    from ingredients i
                    left join speed_map sm on sm.ingredient_id = i.ingredient_id
                    left join products p on p.product_id = sm.bottle_product_id
                    order by i.name;
                ";

                var list = new List<SpeedMapRowDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new SpeedMapRowDto
                    {
                        IngredientId = reader.GetGuid(0),
                        IngredientName = reader.GetString(1),
                        BottleProductId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                        BottleProductName = reader.IsDBNull(3) ? null : reader.GetString(3)
                    });
                }

                return Results.Json(list);
            });

            /* ========== SPEED MAP PUT ========== */
            app.MapPut("/api/speed-map", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                var body = await JsonSerializer.DeserializeAsync<List<UpdateSpeedMapRequestRow>>(req.Body);
                if (body is null)
                    return Results.BadRequest("invalid json");

                foreach (var row in body)
                {
                    if (row.BottleProductId is null)
                    {
                        const string delSql = "delete from speed_map where ingredient_id = $1;";
                        await using var delCmd = db.CreateCommand(delSql);
                        delCmd.Parameters.AddWithValue(row.IngredientId);
                        await delCmd.ExecuteNonQueryAsync();
                    }
                    else
                    {
                        const string upSql = @"
                            insert into speed_map (ingredient_id, bottle_product_id)
                            values ($1,$2)
                            on conflict (ingredient_id)
                            do update set bottle_product_id = excluded.bottle_product_id;
                        ";
                        await using var upCmd = db.CreateCommand(upSql);
                        upCmd.Parameters.AddWithValue(row.IngredientId);
                        upCmd.Parameters.AddWithValue(row.BottleProductId.Value);
                        await upCmd.ExecuteNonQueryAsync();
                    }
                }

                return Results.Ok();
            });

            /* ========== PRICES GET ========== */
            app.MapGet("/api/prices", async (NpgsqlDataSource db) =>
            {
                const string sql = @"
                    select p.product_id,
                           p.name,
                           pr.price
                    from products p
                    left join product_prices pr on pr.product_id = p.product_id
                    order by p.name;
                ";

                var list = new List<PriceRowDto>();

                await using var cmd = db.CreateCommand(sql);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new PriceRowDto
                    {
                        ProductId = reader.GetGuid(0),
                        ProductName = reader.GetString(1),
                        Price = reader.IsDBNull(2) ? (decimal?)null : reader.GetDecimal(2)
                    });
                }

                return Results.Json(list);
            });

            /* ========== PRICES PUT ========== */
            app.MapPut("/api/prices", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                var body = await JsonSerializer.DeserializeAsync<List<UpdatePriceRequestRow>>(req.Body);
                if (body is null)
                    return Results.BadRequest("invalid json");

                foreach (var row in body)
                {
                    const string upSql = @"
                        insert into product_prices (product_id, price)
                        values ($1,$2)
                        on conflict (product_id)
                        do update set price = excluded.price;
                    ";
                    await using var upCmd = db.CreateCommand(upSql);
                    upCmd.Parameters.AddWithValue(row.ProductId);
                    upCmd.Parameters.AddWithValue(row.Price);
                    await upCmd.ExecuteNonQueryAsync();
                }

                return Results.Ok();
            });
        }
    }
}
