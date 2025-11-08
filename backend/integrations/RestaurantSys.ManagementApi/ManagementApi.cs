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
            /* ========== MENUS ========== */
            // Add new menu
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

            // Add new menu
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

            // Delete menu by num
            app.MapDelete("/api/menus/{menuNum:int}", async (int menuNum, NpgsqlDataSource db) =>
            {
                try
                {
                    await using var conn = await db.OpenConnectionAsync();
                    await using var tx = await conn.BeginTransactionAsync();

                    // Ensure menu exists 
                    await using (var check = new NpgsqlCommand(
                        "select 1 from menus where menu_num = @menu_num limit 1;", conn, tx))
                    {
                        check.Parameters.AddWithValue("menu_num", menuNum);
                        var exists = await check.ExecuteScalarAsync();
                        if (exists is null)
                        {
                            await tx.RollbackAsync();
                            return Results.NotFound(new { error = "Menu not found." });
                        }
                    }
                    // Delete all nodes that belong to this menu (if you don't already rely on FK CASCADE)
                    await using (var delNodes = new NpgsqlCommand(
                        "delete from menu_nodes where menu_num = @menu_num;", conn, tx))
                    {
                        delNodes.Parameters.AddWithValue("menu_num", menuNum);
                        await delNodes.ExecuteNonQueryAsync();
                    }

                    // Delete the menu row itself
                    var affected = 0;
                    await using (var delMenu = new NpgsqlCommand(
                        "delete from menus where menu_num = @menu_num;", conn, tx))
                    {
                        delMenu.Parameters.AddWithValue("menu_num", menuNum);
                        affected = await delMenu.ExecuteNonQueryAsync();
                    }

                    if (affected == 0)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Menu not found." });
                    }

                    await tx.CommitAsync();
                    return Results.NoContent();

                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in Delete /api/menus:");
                    Console.Error.WriteLine(ex);
                    return Results.Problem($"POST /api/menus failed: {ex.Message}", statusCode: 500);
                }
            });

            // Edit menu name
            app.MapPatch("/api/menus/{menuNum:int}", async (int menuNum, UpdateMenuPayload payload, NpgsqlDataSource db) =>
            {
                try
                {
                    var name = (payload?.Name ?? "").Trim();
                    if (name.Length == 0) return Results.BadRequest(new { error = "Name is required." });

                    await using var conn = await db.OpenConnectionAsync();
                    await using var tx = await conn.BeginTransactionAsync();

                    // Optional existence check (or rely on affected row == 0 below)

                    const string sql = """
        update menus
        set name = @name
        where menu_num = @menu_num
        returning menu_num, name;
        """;

                    int outMenuNum;
                    string outName;

                    await using (var cmd = new NpgsqlCommand(sql, conn, tx))
                    {
                        cmd.Parameters.AddWithValue("name", name);
                        cmd.Parameters.AddWithValue("menu_num", menuNum);

                        // Limit to one row and ensure reader is disposed before COMMIT
                        await using var reader = await cmd.ExecuteReaderAsync(System.Data.CommandBehavior.SingleRow);

                        if (!await reader.ReadAsync())
                        {
                            await tx.RollbackAsync();
                            return Results.NotFound(new { error = "Menu not found." });
                        }

                        outMenuNum = reader.GetInt32(0);
                        outName = reader.GetString(1);
                        // reader disposed at the end of this using block
                    }

                    await tx.CommitAsync();

                    return Results.Ok(new { menuNum = outMenuNum, name = outName });
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in Patch /api/menus:");
                    Console.Error.WriteLine(ex);
                    return Results.Problem($"PATCH /api/menus failed: {ex.Message}", statusCode: 500);
                }

            });



            /* ========== MENU NODES (TREE) ========== */
            // Get nodes from menu num
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

            // Add new menu node under selected menu
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

            // Delete menu node - deletes all of the sons as well.
            app.MapDelete("/api/menu-nodes/{nodeId:guid}", async (Guid nodeId, NpgsqlDataSource db) =>
            {
                try
                {
                    // Verify exists
                    const string existsSql = "select 1 from public.menu_nodes where node_id = $1;";
                    await using (var chk = db.CreateCommand(existsSql))
                    {
                        chk.Parameters.AddWithValue(nodeId);
                        var exists = await chk.ExecuteScalarAsync();
                        if (exists is null) return Results.NotFound(new { error = "Node not found." });
                    }

                    // Delete node (children will cascade via parent FK; products via products.menu_node_id FK)
                    const string delSql = "delete from public.menu_nodes where node_id = $1;";
                    await using (var cmd = db.CreateCommand(delSql))
                    {
                        cmd.Parameters.AddWithValue(nodeId);
                        await cmd.ExecuteNonQueryAsync();
                    }

                    return Results.NoContent();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in DELETE /api/menu-nodes/{id}:\n" + ex);
                    return Results.Problem($"DELETE /api/menu-nodes failed: {ex.Message}", statusCode: 500);
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

                return Results.Json(
                list,
                new System.Text.Json.JsonSerializerOptions
                {
                     PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
                }
                );
            });

            // Create new ingridient
            app.MapPost("/api/ingredients", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                try
                {
                    var body = await System.Text.Json.JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                    if (body.ValueKind == System.Text.Json.JsonValueKind.Undefined ||
                        body.ValueKind == System.Text.Json.JsonValueKind.Null)
                        return Results.BadRequest(new { error = "Invalid JSON." });

                    var name = body.TryGetProperty("name", out var n) ? n.GetString()?.Trim() ?? "" : "";
                    if (string.IsNullOrWhiteSpace(name))
                        return Results.BadRequest(new { error = "Name is required." });

                    /* Optional field from UI, ignore if backend doesn’t support it yet */
                    var baseUnit = body.TryGetProperty("baseUnit", out var b) ? b.GetString() ?? "" : "";

                    // Check for duplicate (case-insensitive)
                    const string checkSql = "select 1 from public.ingredients where lower(name) = lower($1) limit 1;";
                    await using (var checkCmd = db.CreateCommand(checkSql))
                    {
                        checkCmd.Parameters.AddWithValue(name);
                        var exists = await checkCmd.ExecuteScalarAsync();
                        if (exists is not null)
                            return Results.BadRequest(new { error = "Ingredient already exists." });
                    }

                    // Insert new ingredient
                    var id = Guid.NewGuid();
                    const string insSql = @"
            insert into public.ingredients (ingredient_id, name)
            values ($1, $2);
        ";
                    await using (var insCmd = db.CreateCommand(insSql))
                    {
                        insCmd.Parameters.AddWithValue(id);
                        insCmd.Parameters.AddWithValue(name);
                        await insCmd.ExecuteNonQueryAsync();
                    }

                    return Results.Json(new { ingredientId = id, name, baseUnit });
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in POST /api/ingredients:\n" + ex);
                    return Results.Problem($"POST /api/ingredients failed: {ex.Message}", statusCode: 500);
                }
            });

            // Delete selected Ingridient
            app.MapDelete("/api/ingredients/{id:guid}", async (Guid id, NpgsqlDataSource db) =>
            {
                // 0) Does it exist?
                const string checkIng = "select name from public.ingredients where ingredient_id = $1;";
                string? ingName = null;
                await using (var chk = db.CreateCommand(checkIng))
                {
                    chk.Parameters.AddWithValue(id);
                    var o = await chk.ExecuteScalarAsync();
                    if (o is null) return Results.NotFound(new { error = "Ingredient not found." });
                    ingName = (string)o;
                }

                // 1) Is it referenced by any product?
                const string usageCountSql = "select count(*) from public.product_ingredients where ingredient_id = $1;";
                int usageCount;
                await using (var ccmd = db.CreateCommand(usageCountSql))
                {
                    ccmd.Parameters.AddWithValue(id);
                    usageCount = Convert.ToInt32(await ccmd.ExecuteScalarAsync());
                }

                if (usageCount > 0)
                {
                    // Optional: return up to 5 sample product names to help the user
                    const string sampleSql = @"
            select p.name
            from public.product_ingredients pi
            join public.products p on p.product_id = pi.product_id
            where pi.ingredient_id = $1
            order by lower(p.name)
            limit 5;";
                    var samples = new List<string>();
                    await using (var scmd = db.CreateCommand(sampleSql))
                    {
                        scmd.Parameters.AddWithValue(id);
                        await using var r = await scmd.ExecuteReaderAsync();
                        while (await r.ReadAsync()) samples.Add(r.GetString(0));
                    }

                    return Results.Json(new
                    {
                        error = "Ingredient is in use and cannot be deleted.",
                        ingredientId = id,
                        ingredientName = ingName,
                        inUseCount = usageCount,
                        sampleProducts = samples
                    }, statusCode: StatusCodes.Status409Conflict);
                }

                // 2) Safe to delete
                const string delSql = "delete from public.ingredients where ingredient_id = $1;";
                await using (var del = db.CreateCommand(delSql))
                {
                    del.Parameters.AddWithValue(id);
                    await del.ExecuteNonQueryAsync();
                }

                return Results.NoContent();
            });



            /* ========== PRODUCTS (LIST/FILTER) ========== */
            /* NEW */
            /* Gets all created products */
            app.MapGet("/api/products", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                var search = req.Query["search"].ToString()?.Trim();
                const string sql = @"
        select p.product_id, p.name, p.type, pr.price
        from products p
        left join product_prices pr on pr.product_id = p.product_id
        where (@q is null or p.name ilike '%'||@q||'%')
        order by p.name;
    ";
                var list = new List<ProductListItemDto>();
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.Add("@q", NpgsqlTypes.NpgsqlDbType.Text)
                .Value = string.IsNullOrWhiteSpace(search) ? (object)DBNull.Value : search!;
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    list.Add(new ProductListItemDto
                    {
                        Id = r.GetGuid(0),
                        Name = r.GetString(1),
                        Type = r.GetString(2),
                        // Price = r.IsDBNull(3) ? (decimal?)null : r.GetDecimal(3)
                    });
                }
                return Results.Json(list);
            });

            app.MapGet("/api/menu-nodes/{nodeId:guid}/products", async (Guid nodeId, NpgsqlDataSource db) =>
            {
                const string sql = @"
        select
          p.product_id,
          p.name,
          p.type,
          pr.price           -- <- ensure this is the actual column name
        from product_menu_nodes pmn
        join products    p  on p.product_id = pmn.product_id
        join menu_nodes  mn on mn.node_id   = pmn.menu_node_id
        left join product_prices pr
               on pr.product_id = p.product_id
              and pr.menu_num   = mn.menu_num
        where pmn.menu_node_id = @node
        order by p.name;
    ";

                var list = new List<ProductListItemDto>();
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("@node", NpgsqlTypes.NpgsqlDbType.Uuid, nodeId);

                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    var priceCents = r.IsDBNull(3) ? (int?)null : r.GetInt32(3);

                    list.Add(new ProductListItemDto
                    {
                        Id = r.GetGuid(0),
                        Name = r.GetString(1),
                        Type = r.GetString(2),
                        Price = priceCents,     // <- include price
                    });
                }

                return Results.Json(list);
            });


            app.MapPost("/api/menu-nodes/{nodeId:guid}/products", async (Guid nodeId, HttpRequest req, NpgsqlDataSource db) =>
            {
                var body = await req.ReadFromJsonAsync<LinkProductRequest>();
                if (body is null || body.ProductId == Guid.Empty)
                    return Results.BadRequest(new { error = "ProductId is required." });

                const string sql = @"
        insert into product_menu_nodes (product_id, menu_node_id)
        values (@pid, @nid)
        on conflict do nothing;
    ";
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, body.ProductId);
                cmd.Parameters.AddWithValue("@nid", NpgsqlTypes.NpgsqlDbType.Uuid, nodeId);
                await cmd.ExecuteNonQueryAsync();

                return Results.NoContent();
            });


            /* NEW */
            app.MapPost("/api/products", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                try
                {
                    var body = await req.ReadFromJsonAsync<CreateSimpleProductRequest>();
                    if (body is null) return Results.BadRequest(new { error = "Invalid JSON." });

                    var name = (body.Name ?? string.Empty).Trim();
                    if (name.Length == 0) return Results.BadRequest(new { error = "Name is required." });

                    body.Components ??= new List<CreateProductComponentRequest>();

                    // collect node ids from single + multi
                    var nodeIds = new HashSet<Guid>();
                    if (body.MenuNodeId is Guid single && single != Guid.Empty) nodeIds.Add(single);
                    if (body.MenuNodeIds is { Count: > 0 })
                        foreach (var id in body.MenuNodeIds)
                            if (id != Guid.Empty) nodeIds.Add(id);

                    await using var conn = await db.OpenConnectionAsync();
                    await using var tx = await conn.BeginTransactionAsync();

                    // validate menu nodes (exist and are leaf) if any provided
                    if (nodeIds.Count > 0)
                    {
                        const string nodeSql = @"
                select node_id, is_leaf
                from public.menu_nodes
                where node_id = any(@ids::uuid[])
            ";
                        await using (var nodeCmd = new NpgsqlCommand(nodeSql, conn, tx))
                        {
                            nodeCmd.Parameters.AddWithValue("@ids", nodeIds.ToArray());
                            var seen = new HashSet<Guid>();
                            await using var r = await nodeCmd.ExecuteReaderAsync();
                            var nonLeafFound = false;
                            while (await r.ReadAsync())
                            {
                                var nid = r.GetGuid(0);
                                var isLeaf = r.GetBoolean(1);
                                seen.Add(nid);
                                if (!isLeaf) nonLeafFound = true;
                            }
                            await r.DisposeAsync();

                            if (seen.Count != nodeIds.Count)
                                return Results.BadRequest(new { error = "One or more menu nodes do not exist." });
                            if (nonLeafFound)
                                return Results.BadRequest(new { error = "Product must be attached only to leaf nodes." });
                        }
                    }

                    // validate ingredients if components provided
                    var comps = body.Components
                        .Where(x => x is not null && x.IngredientId != Guid.Empty)
                        .GroupBy(x => x.IngredientId)
                        .Select(g => new
                        {
                            IngredientId = g.Key,
                            IsChangeable = g.Last().IsChangeable,
                            IsLeading = g.Last().IsLeading,
                            AmountMl = g.Last().AmountMl
                        })
                        .ToArray();

                    if (comps.Length > 0)
                    {
                        const string ingSql = "select count(*) from public.ingredients where ingredient_id = any(@ids::uuid[])";
                        await using var ingCmd = new NpgsqlCommand(ingSql, conn, tx);
                        ingCmd.Parameters.AddWithValue("@ids", comps.Select(c => c.IngredientId).ToArray());
                        var foundCount = Convert.ToInt32(await ingCmd.ExecuteScalarAsync());
                        if (foundCount != comps.Length)
                            return Results.BadRequest(new { error = "One or more ingredientIds do not exist." });
                    }

                    // insert product (legacy column menu_node_id kept nullable for now)
                    var newId = Guid.NewGuid();
                    const string insProd = @"
            insert into public.products (product_id, menu_node_id, name, type, sold_as_bottle_only)
            values (@pid, @menu_node_id, @name, @type, @sold)
        ";
                    await using (var pCmd = new NpgsqlCommand(insProd, conn, tx))
                    {
                        pCmd.Parameters.Add("@pid", NpgsqlTypes.NpgsqlDbType.Uuid).Value = newId;

                        // IMPORTANT: always declare the type for nullable params
                        var pMenuNode = pCmd.Parameters.Add("@menu_node_id", NpgsqlTypes.NpgsqlDbType.Uuid);
                        pMenuNode.Value = (nodeIds.Count == 1) ? nodeIds.First() : DBNull.Value;

                        pCmd.Parameters.Add("@name", NpgsqlTypes.NpgsqlDbType.Text).Value = name;

                        // Constant type for all products (change the string if you prefer "Bottle" etc.)
                        pCmd.Parameters.Add("@type", NpgsqlTypes.NpgsqlDbType.Text).Value = "Cocktail";

                        pCmd.Parameters.Add("@sold", NpgsqlTypes.NpgsqlDbType.Boolean).Value = body.SoldAsBottleOnly;

                        await pCmd.ExecuteNonQueryAsync();
                    }

                    // insert many-to-many links (one row per node id)
                    if (nodeIds.Count > 0)
                    {
                        const string linkSql = @"
                insert into public.product_menu_nodes (product_id, menu_node_id)
                values (@pid, @nid)
                on conflict do nothing
            ";
                        foreach (var nid in nodeIds)
                        {
                            await using var linkCmd = new NpgsqlCommand(linkSql, conn, tx);
                            linkCmd.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, newId);
                            linkCmd.Parameters.AddWithValue("@nid", NpgsqlTypes.NpgsqlDbType.Uuid, nid);
                            await linkCmd.ExecuteNonQueryAsync();
                        }
                    }

                    // insert components (same as your version; AmountMl kept for future if needed)
                    if (comps.Length > 0)
                    {
                        const string insComp = @"
                insert into public.product_ingredients (product_id, ingredient_id, changeable, is_leading)
                values (@pid, @ing, @chg, @lead)
                on conflict (product_id, ingredient_id) do update
                set changeable = excluded.changeable,
                    is_leading = excluded.is_leading
            ";
                        foreach (var c in comps)
                        {
                            await using var cCmd = new NpgsqlCommand(insComp, conn, tx);
                            cCmd.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, newId);
                            cCmd.Parameters.AddWithValue("@ing", NpgsqlTypes.NpgsqlDbType.Uuid, c.IngredientId);
                            cCmd.Parameters.AddWithValue("@chg", c.IsChangeable);
                            cCmd.Parameters.AddWithValue("@lead", c.IsLeading);
                            await cCmd.ExecuteNonQueryAsync();
                        }
                    }

                    await tx.CommitAsync();

                    return Results.Json(new
                    {
                        productId = newId,
                        name,
                        soldAsBottleOnly = body.SoldAsBottleOnly,
                        attachedNodeIds = nodeIds.ToArray(),
                        components = comps
                    });
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in POST /api/products:\n" + ex);
                    return Results.Problem($"POST /api/products failed: {ex.Message}", statusCode: 500);
                }
            });



            /* NEW */
            // Delete selected Prodduct



            /* ========== PRICES ========== */
            app.MapPost("/api/product-prices", async (HttpRequest req, NpgsqlDataSource db) =>
            {
                try
                {
                    var opts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var body = await req.ReadFromJsonAsync<UpsertProductPriceRequest>(opts);
                    Console.WriteLine($"[POST /api/product-prices] pid={body?.ProductId} menu={body?.MenuNum} price={body?.Price}");

                    if (body is null) return Results.BadRequest(new { error = "Invalid JSON." });
                    if (body.ProductId == Guid.Empty) return Results.BadRequest(new { error = "ProductId is required." });
                    if (body.MenuNum <= 0) return Results.BadRequest(new { error = "menuNum must be positive." });

                    const string sql = @"
        insert into public.product_prices (product_id, menu_num, price)
        values (@pid, @menu, @price)
        on conflict on constraint product_prices_pkey
        do update set price = excluded.price;
    ";
                    await using var cmd = db.CreateCommand(sql);
                    cmd.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, body.ProductId);
                    cmd.Parameters.AddWithValue("@menu", NpgsqlTypes.NpgsqlDbType.Integer, body.MenuNum);
                    cmd.Parameters.AddWithValue("@price", NpgsqlTypes.NpgsqlDbType.Numeric, (object?)body.Price ?? DBNull.Value);
                    await cmd.ExecuteNonQueryAsync();
                    return Results.NoContent();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in POST /api/products-prices:\n" + ex);
                    return Results.Problem($"POST /api/products-prices failed: {ex.Message}", statusCode: 500);
                }
            });

            app.MapDelete("/api/menu-nodes/{nodeId:guid}/products/{productId:guid}", async (Guid nodeId, Guid productId, NpgsqlDataSource db) =>
            {
                try
                {
                    const string sql = @"delete from product_menu_nodes where menu_node_id = @nid and product_id = @pid;";
                    await using var cmd = db.CreateCommand(sql);
                    cmd.Parameters.AddWithValue("@nid", NpgsqlTypes.NpgsqlDbType.Uuid, nodeId);
                    cmd.Parameters.AddWithValue("@pid", NpgsqlTypes.NpgsqlDbType.Uuid, productId);
                    var rows = await cmd.ExecuteNonQueryAsync();
                    return rows > 0 ? Results.NoContent() : Results.NotFound();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error in Delete /api/menu-nodes/{nodeId:guid}/products/{productId:guid}:\n" + ex);
                    return Results.Problem($"DELETE /api/menu-nodes/{{nodeId:guid}}/products/{{productId:guid}} failed: {ex.Message}", statusCode: 500);
                }
            });



            /* ========== SPEED MAP ========== */
            /* NEW */
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

            /* NEW */
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

        
        }
    }
}
