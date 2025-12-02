using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;
using System.Text.Json;

namespace RestaurantSys.Api.Endpoints;

public static class MenuNodesEndpoints
{
    public static void MapMenuNodesEndpoints(this WebApplication app)
    {
        // ===== MENU NODES (TREE) =====
        // GET /api/menu-nodes
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

        // POST /api/menu-nodes
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

        // DELETE /api/menu-nodes/{nodeId}
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
    }
}
