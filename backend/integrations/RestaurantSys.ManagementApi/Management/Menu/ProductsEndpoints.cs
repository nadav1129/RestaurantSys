using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class ProductsEndpoints
{
    public static void MapProductsEndpoints(this WebApplication app)
    {
        // ===== PRODUCTS =====
        // GET /api/products
        app.MapGet("/api/products", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
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
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/products:\n" + ex);
                return Results.Problem($"GET /api/products failed: {ex.Message}", statusCode: 500);
            }
        });

        // GET /api/menu-nodes/{nodeId}/products
        app.MapGet("/api/menu-nodes/{nodeId:guid}/products", async (Guid nodeId, NpgsqlDataSource db) =>
        {
            try
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
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/menu-nodes/{nodeId}/products:\n" + ex);
                return Results.Problem($"GET /api/products failed: {ex.Message}", statusCode: 500);
            }
        });

        // POST /api/menu-nodes/{nodeId}/products
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

        // POST /api/products

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


        // DELETE link: /api/menu-nodes/{nodeId}/products/{productId}
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
    }
}
