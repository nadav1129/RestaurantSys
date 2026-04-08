using System.Text.Json;
using Npgsql;
using RestaurantSys.Api;

namespace RestaurantSys.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this WebApplication app)
    {

        /* =========================================
   POST /api/orders/confirm
   One-shot endpoint used by OrderPage:

   Body:
   {
     shiftId: string,
     table: string,                // "none" for quick orders (no table)
     guestName?: string,
     guestPhone?: string,
     dinersCount?: number,
     note?: string,
     items: [
       {
         productId: string,
         name: string,             // optional on server
         qty: number,
         unitPrice: number,        // in shekels
         additions: string[],      // ignored for now
         notes?: string            // ignored for now
       }
     ]
   }

   Behaviour (single transaction):
   - Find or create an open order for (shiftId, table_id[NULL for now])
   - Insert order_items rows for each item
   - (Later: also fan out to checker / bar queues)
   ========================================= */

        app.MapPost("/api/orders/confirm", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                /* shiftId */
                if (!TryGetGuid(body, "shiftId", out var shiftId) || shiftId == Guid.Empty)
                    return Results.BadRequest(new { error = "shiftId is required." });

                /* table identity (accept: tableId OR tableNum OR legacy table string) */
                Guid? tableId = null;
                if (TryGetGuid(body, "tableId", out var tId) && tId != Guid.Empty)
                    tableId = tId;

                int? tableNum = null;

                if (body.TryGetProperty("tableNum", out var tn))
                {
                    if (tn.ValueKind == JsonValueKind.Number && tn.TryGetInt32(out var n)) 
                        tableNum = n;
                    else if (tn.ValueKind == JsonValueKind.String && int.TryParse(tn.GetString(), out var ns)) 
                        tableNum = ns;
                }

                var tableString = GetString(body, "table"); /* legacy support */
                if (tableNum is null && !string.IsNullOrWhiteSpace(tableString) && !tableString.Equals("none", StringComparison.OrdinalIgnoreCase))
                {
                    if (int.TryParse(tableString, out var n2)) tableNum = n2;
                }

                /* other fields */
                var guestName = GetString(body, "guestName");
                var guestPhone = GetString(body, "guestPhone");
                var dinersCount = GetInt(body, "dinersCount");
                var note = GetString(body, "note");
                Guid? originStationId = TryGetGuid(body, "originStationId", out var originStationGuid) && originStationGuid != Guid.Empty
                    ? originStationGuid
                    : (Guid?)null;

                /* items */
                if (!body.TryGetProperty("items", out var itemsEl) ||itemsEl.ValueKind != JsonValueKind.Array ||itemsEl.GetArrayLength() == 0)
                {
                    return Results.BadRequest(new { error = "items is required and must be a non-empty array." });
                }

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                /* Resolve tableNum -> tableId (critical fix - to be removed) */
                if (tableId is null && tableNum is not null)
                {
                    const string TABLE_LOOKUP = @"
                select table_id
                from tables
                where table_number = @table_number
                limit 1;";

                    await using var tcmd = new NpgsqlCommand(TABLE_LOOKUP, conn, tx);
                    tcmd.Parameters.AddWithValue("table_number", tableNum.Value);

                    var res = await tcmd.ExecuteScalarAsync();
                    if (res is Guid g) tableId = g;
                    else
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = $"Unknown table_number {tableNum}." });
                    }
                }

                var route = await OrderRoutingResolver.ResolveAsync(conn, originStationId, tx);

                Guid orderId;

                /* Find/create open order:
                   - If tableId != null => one open order per (shiftId, tableId)
                   - If tableId == null => treat as "quick" order (NULL table); still find/create but never mixes with table orders
                */
                if (tableId is null)
                {
                    const string FIND_QUICK = @"
                select order_id
                from orders
                where shift_id = @shift_id
                  and table_id is null
                  and status = 'open'
                  and source = 'quick'
                  and (
                        (@origin_station_id is null and origin_station_id is null)
                     or origin_station_id = @origin_station_id
                  )
                limit 1;";

                    await using var findCmd = new NpgsqlCommand(FIND_QUICK, conn, tx);
                    findCmd.Parameters.AddWithValue("shift_id", shiftId);
                    findCmd.Parameters.AddWithValue("origin_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)originStationId ?? DBNull.Value);

                    var found = await findCmd.ExecuteScalarAsync();
                    if (found is Guid fg)
                    {
                        orderId = fg;
                    }
                    else
                    {
                        const string INSERT_QUICK = @"
                    insert into orders
                      (shift_id, table_id, opened_by_worker_id, origin_station_id, checker_station_id, source, status,
                       opened_at, guest_name, guest_phone, diners_count, note)
                    values
                      (@shift_id, null, null, @origin_station_id, @checker_station_id, 'quick', 'open',
                       now(), @guest_name, @guest_phone, @diners_count, @note)
                    returning order_id;";

                        await using var insertCmd = new NpgsqlCommand(INSERT_QUICK, conn, tx);
                        insertCmd.Parameters.AddWithValue("shift_id", shiftId);
                        insertCmd.Parameters.AddWithValue("origin_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)originStationId ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("checker_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)route.CheckerStationId ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("guest_name", (object?)guestName ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("guest_phone", (object?)guestPhone ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("diners_count", (object?)dinersCount ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);

                        var created = await insertCmd.ExecuteScalarAsync();
                        if (created is not Guid og)
                        {
                            await tx.RollbackAsync();
                            return Results.Problem("Failed to create quick order.", statusCode: 500);
                        }
                        orderId = og;
                    }
                }
                else
                {
                    const string FIND_TABLE = @"
                select order_id
                from orders
                where shift_id = @shift_id
                  and table_id = @table_id
                  and status = 'open'
                limit 1;";

                    await using var findCmd = new NpgsqlCommand(FIND_TABLE, conn, tx);
                    findCmd.Parameters.AddWithValue("shift_id", shiftId);
                    findCmd.Parameters.AddWithValue("table_id", tableId.Value);

                    var found = await findCmd.ExecuteScalarAsync();
                    if (found is Guid fg)
                    {
                        orderId = fg;
                    }
                    else
                    {
                        const string INSERT_TABLE = @"
                    insert into orders
                      (shift_id, table_id, opened_by_worker_id, origin_station_id, checker_station_id, source, status,
                       opened_at, guest_name, guest_phone, diners_count, note)
                    values
                      (@shift_id, @table_id, null, @origin_station_id, @checker_station_id, 'table', 'open',
                       now(), @guest_name, @guest_phone, @diners_count, @note)
                    returning order_id;";

                        await using var insertCmd = new NpgsqlCommand(INSERT_TABLE, conn, tx);
                        insertCmd.Parameters.AddWithValue("shift_id", shiftId);
                        insertCmd.Parameters.AddWithValue("table_id", tableId.Value);
                        insertCmd.Parameters.AddWithValue("origin_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)originStationId ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("checker_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)route.CheckerStationId ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("guest_name", (object?)guestName ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("guest_phone", (object?)guestPhone ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("diners_count", (object?)dinersCount ?? DBNull.Value);
                        insertCmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);

                        var created = await insertCmd.ExecuteScalarAsync();
                        if (created is not Guid og)
                        {
                            await tx.RollbackAsync();
                            return Results.Problem("Failed to create table order.", statusCode: 500);
                        }
                        orderId = og;
                    }
                }

                const string updateRoutingSql = @"
                    update orders
                    set origin_station_id = coalesce(origin_station_id, @origin_station_id),
                        checker_station_id = coalesce(checker_station_id, @checker_station_id)
                    where order_id = @order_id;";

                await using (var updateRoutingCmd = new NpgsqlCommand(updateRoutingSql, conn, tx))
                {
                    updateRoutingCmd.Parameters.AddWithValue("origin_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)originStationId ?? DBNull.Value);
                    updateRoutingCmd.Parameters.AddWithValue("checker_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)route.CheckerStationId ?? DBNull.Value);
                    updateRoutingCmd.Parameters.AddWithValue("order_id", orderId);
                    await updateRoutingCmd.ExecuteNonQueryAsync();
                }

                /* Insert items */
                const string insertItemSql = @"
            insert into order_items (order_id, product_id, quantity, price_cents, item_status)
            values (@order_id, @product_id, @quantity, @price, 'in_progress');";

                foreach (var item in itemsEl.EnumerateArray())
                {
                    if (!TryGetGuid(item, "productId", out var productId) || productId == Guid.Empty)
                    {
                        await tx.RollbackAsync();
                        return Results.BadRequest(new { error = "Each item must have a valid productId." });
                    }

                    int qty = 1;
                    if (item.TryGetProperty("qty", out var qtyEl) &&
                        qtyEl.ValueKind == JsonValueKind.Number &&
                        qtyEl.TryGetInt32(out var q) && q > 0)
                    {
                        qty = q;
                    }

                    /* price lookup */
                    int price = 0;
                    const string priceSql = @"select price from product_prices where product_id = @product_id;";
                    await using (var priceCmd = new NpgsqlCommand(priceSql, conn, tx))
                    {
                        priceCmd.Parameters.AddWithValue("product_id", productId);
                        var p = await priceCmd.ExecuteScalarAsync();
                        if (p is int pc) price = pc;
                        else if (p is long pl) price = (int)pl;
                        else if (p is decimal pd) price = (int)Math.Round(pd * 100m, MidpointRounding.AwayFromZero);
                    }

                    await using var itemCmd = new NpgsqlCommand(insertItemSql, conn, tx);
                    itemCmd.Parameters.AddWithValue("order_id", orderId);
                    itemCmd.Parameters.AddWithValue("product_id", productId);
                    itemCmd.Parameters.AddWithValue("quantity", qty);
                    itemCmd.Parameters.AddWithValue("price", price);

                    await itemCmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();

                return Results.Json(
                    new
                    {
                        orderId,
                        checkerStationId = route.CheckerStationId,
                        revenueCenterId = route.RevenueCenterId
                    },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/orders/confirm:\n" + ex);
                return Results.Problem("POST /api/orders/confirm failed", statusCode: 500);
            }
        });




        /* =========================================
           GET /api/shifts/{shiftId}/orders
           ========================================= */
        app.MapGet("/api/shifts/{shiftId:guid}/orders", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select
                      o.order_id,
                      o.shift_id,
                      o.table_id,
                      t.table_number,
                      o.source,
                      o.status,
                      o.opened_at,
                      o.closed_at,
                      o.guest_name,
                      o.guest_phone,
                      o.diners_count,
                      o.note,
                      o.min_spend_cents,
                      o.total_before_tip_cents,
                      o.tip_cents,
                      o.total_cents,
                      o.paid_cents,
                      o.payment_status
                    from orders o
                    left join tables t on t.table_id = o.table_id
                    where o.shift_id = @shift_id
                    order by o.opened_at;
                ";

                var list = new List<object>();

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new
                    {
                        OrderId = reader.GetGuid(0),
                        ShiftId = reader.GetGuid(1),
                        TableId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                        TableNumber = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3),
                        Source = reader.GetString(4),
                        Status = reader.GetString(5),
                        OpenedAt = reader.GetDateTime(6),
                        ClosedAt = reader.IsDBNull(7) ? (DateTime?)null : reader.GetDateTime(7),
                        GuestName = reader.IsDBNull(8) ? null : reader.GetString(8),
                        GuestPhone = reader.IsDBNull(9) ? null : reader.GetString(9),
                        DinersCount = reader.IsDBNull(10) ? (int?)null : reader.GetInt32(10),
                        Note = reader.IsDBNull(11) ? null : reader.GetString(11),
                        MinSpendCents = reader.IsDBNull(12) ? (int?)null : reader.GetInt32(12),
                        TotalBeforeTipCents = reader.IsDBNull(13) ? (int?)null : reader.GetInt32(13),
                        TipCents = reader.IsDBNull(14) ? (int?)null : reader.GetInt32(14),
                        TotalCents = reader.IsDBNull(15) ? (int?)null : reader.GetInt32(15),
                        PaidCents = reader.IsDBNull(16) ? (int?)null : reader.GetInt32(16),
                        PaymentStatus = reader.GetString(17)
                    });
                }

                return Results.Json(
                    list,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/orders");
                Console.Error.WriteLine(ex);

                return Results.Problem("Fetching shift failed.", statusCode: 500);
            }
        });

        /* =========================================
           GET /api/orders/{orderId}
           ========================================= */
        app.MapGet("/api/orders/{orderId:guid}", async (Guid orderId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
                    select
                      o.order_id,
                      o.shift_id,
                      o.table_id,
                      t.table_number,
                      o.opened_by_worker_id,
                      o.closed_by_worker_id,
                      o.source,
                      o.status,
                      o.opened_at,
                      o.closed_at,
                      o.guest_name,
                      o.guest_phone,
                      o.diners_count,
                      o.note,
                      o.min_spend_cents,
                      o.total_before_tip_cents,
                      o.tip_cents,
                      o.total_cents,
                      o.paid_cents,
                      o.payment_status,
                      o.created_at
                    from orders o
                    left join tables t on t.table_id = o.table_id
                    where o.order_id = @order_id;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_id", orderId);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound(new { error = "Order not found." });
                }

                var obj = new
                {
                    OrderId = reader.GetGuid(0),
                    ShiftId = reader.GetGuid(1),
                    TableId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                    TableNumber = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3),
                    OpenedByWorkerId = reader.IsDBNull(4) ? (Guid?)null : reader.GetGuid(4),
                    ClosedByWorkerId = reader.IsDBNull(5) ? (Guid?)null : reader.GetGuid(5),
                    Source = reader.GetString(6),
                    Status = reader.GetString(7),
                    OpenedAt = reader.GetDateTime(8),
                    ClosedAt = reader.IsDBNull(9) ? (DateTime?)null : reader.GetDateTime(9),
                    GuestName = reader.IsDBNull(10) ? null : reader.GetString(10),
                    GuestPhone = reader.IsDBNull(11) ? null : reader.GetString(11),
                    DinersCount = reader.IsDBNull(12) ? (int?)null : reader.GetInt32(12),
                    Note = reader.IsDBNull(13) ? null : reader.GetString(13),
                    MinSpendCents = reader.IsDBNull(14) ? (int?)null : reader.GetInt32(14),
                    TotalBeforeTipCents = reader.IsDBNull(15) ? (int?)null : reader.GetInt32(15),
                    TipCents = reader.IsDBNull(16) ? (int?)null : reader.GetInt32(16),
                    TotalCents = reader.IsDBNull(17) ? (int?)null : reader.GetInt32(17),
                    PaidCents = reader.IsDBNull(18) ? (int?)null : reader.GetInt32(18),
                    PaymentStatus = reader.GetString(19),
                    CreatedAt = reader.GetDateTime(20)
                };

                return Results.Json(
                    obj,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/orders/{orderId}:\n" + ex);
                return Results.Problem("GET /api/orders/{orderId} failed", statusCode: 500);
            }
        });

        /* =========================================
           POST /api/orders  (create new order)
           Body expected (flexible):
           {
             shiftId: string,
             tableId?: string,
             openedByWorkerId?: string,
             source?: string,
             guestName?: string,
             guestPhone?: string,
             dinersCount?: number,
             note?: string,
             minSpendCents?: number
           }
           ========================================= */

        app.MapPost("/api/orders", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                Guid shiftId;
                if (!TryGetGuid(body, "shiftId", out shiftId) || shiftId == Guid.Empty)
                    return Results.BadRequest(new { error = "shiftId is required." });

                Guid? tableId = TryGetGuid(body, "tableId", out var tId) && tId != Guid.Empty ? tId : (Guid?)null;
                Guid? openedByWorkerId = TryGetGuid(body, "openedByWorkerId", out var wId) && wId != Guid.Empty ? wId : (Guid?)null;
                Guid? originStationId = TryGetGuid(body, "originStationId", out var originStationGuid) && originStationGuid != Guid.Empty ? originStationGuid : (Guid?)null;

                var source = GetString(body, "source")?.Trim();
                if (string.IsNullOrEmpty(source))
                    source = "table";

                var guestName = GetString(body, "guestName");
                var guestPhone = GetString(body, "guestPhone");
                var dinersCount = GetInt(body, "dinersCount");
                var note = GetString(body, "note");
                var minSpend = GetInt(body, "minSpendCents");
                Guid? checkerStationId = null;

                await using var conn = await db.OpenConnectionAsync();
                var route = await OrderRoutingResolver.ResolveAsync(conn, originStationId);
                checkerStationId = route.CheckerStationId;

                const string sql = @"
                    insert into orders
                      (shift_id, table_id, opened_by_worker_id, origin_station_id, checker_station_id, source, status,
                       opened_at, guest_name, guest_phone, diners_count, note,
                       min_spend_cents)
                    values
                      (@shift_id, @table_id, @opened_by_worker_id, @origin_station_id, @checker_station_id, @source, 'open',
                       now(), @guest_name, @guest_phone, @diners_count, @note,
                       @min_spend_cents)
                    returning
                      order_id, shift_id, table_id, source, status, opened_at,
                      guest_name, guest_phone, diners_count, note, min_spend_cents;
                ";

                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                cmd.Parameters.AddWithValue("shift_id", shiftId);
                cmd.Parameters.AddWithValue("table_id", (object?)tableId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("opened_by_worker_id", (object?)openedByWorkerId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("origin_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)originStationId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("checker_station_id", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)checkerStationId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("source", source);
                cmd.Parameters.AddWithValue("guest_name", (object?)guestName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("guest_phone", (object?)guestPhone ?? DBNull.Value);
                cmd.Parameters.AddWithValue("diners_count", (object?)dinersCount ?? DBNull.Value);
                cmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);
                cmd.Parameters.AddWithValue("min_spend_cents", (object?)minSpend ?? DBNull.Value);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.Problem("Failed to create order.", statusCode: 500);
                }

                var obj = new
                {
                    OrderId = reader.GetGuid(0),
                    ShiftId = reader.GetGuid(1),
                    TableId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                    Source = reader.GetString(3),
                    Status = reader.GetString(4),
                    OpenedAt = reader.GetDateTime(5),
                    GuestName = reader.IsDBNull(6) ? null : reader.GetString(6),
                    GuestPhone = reader.IsDBNull(7) ? null : reader.GetString(7),
                    DinersCount = reader.IsDBNull(8) ? (int?)null : reader.GetInt32(8),
                    Note = reader.IsDBNull(9) ? null : reader.GetString(9),
                    MinSpendCents = reader.IsDBNull(10) ? (int?)null : reader.GetInt32(10)
                };

                return Results.Json(
                    obj,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/orders:\n" + ex);
                return Results.Problem("POST /api/orders failed", statusCode: 500);
            }
        });

        /* =========================================
           PATCH /api/orders/{orderId}
           Partial update. Body can contain any of:
           guestName, guestPhone, dinersCount, note,
           minSpendCents, totalBeforeTipCents, tipCents,
           totalCents, paidCents, paymentStatus, status,
           closedAt, closedByWorkerId
           ========================================= */

        app.MapPatch("/api/orders/{orderId:guid}", async (Guid orderId, HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body);
                if (body.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var guestName = GetString(body, "guestName");
                var guestPhone = GetString(body, "guestPhone");
                var dinersCount = GetInt(body, "dinersCount");
                var note = GetString(body, "note");
                var minSpend = GetInt(body, "minSpendCents");
                var totalBeforeTip = GetInt(body, "totalBeforeTipCents");
                var tipCents = GetInt(body, "tipCents");
                var totalCents = GetInt(body, "totalCents");
                var paidCents = GetInt(body, "paidCents");
                var paymentStatus = GetString(body, "paymentStatus");
                var status = GetString(body, "status");
                var closedAt = GetDateTime(body, "closedAt");
                Guid? closedByWorkerId = TryGetGuid(body, "closedByWorkerId", out var cwid) && cwid != Guid.Empty ? cwid : (Guid?)null;

                // if status becomes closed and closedAt not provided, set now
                if (status != null &&
                    status.Equals("closed", StringComparison.OrdinalIgnoreCase) &&
                    closedAt == null)
                {
                    closedAt = DateTime.UtcNow;
                }

                const string sql = @"
                    update orders set
                      guest_name             = coalesce(@guest_name, guest_name),
                      guest_phone            = coalesce(@guest_phone, guest_phone),
                      diners_count           = coalesce(@diners_count, diners_count),
                      note                   = coalesce(@note, note),
                      min_spend_cents        = coalesce(@min_spend_cents, min_spend_cents),
                      total_before_tip_cents = coalesce(@total_before_tip_cents, total_before_tip_cents),
                      tip_cents              = coalesce(@tip_cents, tip_cents),
                      total_cents            = coalesce(@total_cents, total_cents),
                      paid_cents             = coalesce(@paid_cents, paid_cents),
                      payment_status         = coalesce(@payment_status, payment_status),
                      status                 = coalesce(@status, status),
                      closed_at              = coalesce(@closed_at, closed_at),
                      closed_by_worker_id    = coalesce(@closed_by_worker_id, closed_by_worker_id)
                    where order_id = @order_id
                    returning
                      order_id, shift_id, table_id, source, status,
                      opened_at, closed_at, guest_name, guest_phone,
                      diners_count, note, min_spend_cents,
                      total_before_tip_cents, tip_cents, total_cents,
                      paid_cents, payment_status;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("guest_name", (object?)guestName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("guest_phone", (object?)guestPhone ?? DBNull.Value);
                cmd.Parameters.AddWithValue("diners_count", (object?)dinersCount ?? DBNull.Value);
                cmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);
                cmd.Parameters.AddWithValue("min_spend_cents", (object?)minSpend ?? DBNull.Value);
                cmd.Parameters.AddWithValue("total_before_tip_cents", (object?)totalBeforeTip ?? DBNull.Value);
                cmd.Parameters.AddWithValue("tip_cents", (object?)tipCents ?? DBNull.Value);
                cmd.Parameters.AddWithValue("total_cents", (object?)totalCents ?? DBNull.Value);
                cmd.Parameters.AddWithValue("paid_cents", (object?)paidCents ?? DBNull.Value);
                cmd.Parameters.AddWithValue("payment_status", (object?)paymentStatus ?? DBNull.Value);
                cmd.Parameters.AddWithValue("status", (object?)status ?? DBNull.Value);
                cmd.Parameters.AddWithValue("closed_at", (object?)closedAt ?? DBNull.Value);
                cmd.Parameters.AddWithValue("closed_by_worker_id", (object?)closedByWorkerId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("order_id", orderId);

                await using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return Results.NotFound(new { error = "Order not found." });
                }

                var obj = new
                {
                    OrderId = reader.GetGuid(0),
                    ShiftId = reader.GetGuid(1),
                    TableId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                    Source = reader.GetString(3),
                    Status = reader.GetString(4),
                    OpenedAt = reader.GetDateTime(5),
                    ClosedAt = reader.IsDBNull(6) ? (DateTime?)null : reader.GetDateTime(6),
                    GuestName = reader.IsDBNull(7) ? null : reader.GetString(7),
                    GuestPhone = reader.IsDBNull(8) ? null : reader.GetString(8),
                    DinersCount = reader.IsDBNull(9) ? (int?)null : reader.GetInt32(9),
                    Note = reader.IsDBNull(10) ? null : reader.GetString(10),
                    MinSpendCents = reader.IsDBNull(11) ? (int?)null : reader.GetInt32(11),
                    TotalBeforeTipCents = reader.IsDBNull(12) ? (int?)null : reader.GetInt32(12),
                    TipCents = reader.IsDBNull(13) ? (int?)null : reader.GetInt32(13),
                    TotalCents = reader.IsDBNull(14) ? (int?)null : reader.GetInt32(14),
                    PaidCents = reader.IsDBNull(15) ? (int?)null : reader.GetInt32(15),
                    PaymentStatus = reader.GetString(16)
                };

                return Results.Json(
                    obj,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PATCH /api/orders/{orderId}:\n" + ex);
                return Results.Problem("PATCH /api/orders/{orderId} failed", statusCode: 500);
            }
        });

        app.MapPut("/api/orders/{orderId:guid}/payments", async (Guid orderId, SaveOrderPaymentsRequest payload, NpgsqlDataSource db) =>
        {
            try
            {
                if (payload is null)
                    return Results.BadRequest(new { error = "Invalid JSON." });

                var payments = payload.Payments ?? new List<SaveOrderPaymentLineRequest>();

                foreach (var payment in payments)
                {
                    if (payment.SplitIndex < 0)
                        return Results.BadRequest(new { error = "splitIndex must be zero or greater." });

                    if (string.IsNullOrWhiteSpace(payment.Method) ||
                        !(payment.Method == "cash" || payment.Method == "credit_card" || payment.Method == "company_card"))
                    {
                        return Results.BadRequest(new { error = "Invalid payment method." });
                    }

                    if (payment.BaseAmountCents < 0 || payment.TipCents < 0 || payment.TotalAmountCents < 0)
                        return Results.BadRequest(new { error = "Payment amounts must be zero or greater." });

                    if (payment.ReceivedCents is int received && received < 0)
                        return Results.BadRequest(new { error = "receivedCents must be zero or greater." });

                    if (payment.ChangeCents is int change && change < 0)
                        return Results.BadRequest(new { error = "changeCents must be zero or greater." });

                    if (!string.IsNullOrWhiteSpace(payment.CardEntryMode) &&
                        payment.CardEntryMode is not ("manual" or "scanner"))
                    {
                        return Results.BadRequest(new { error = "cardEntryMode must be manual, scanner, or null." });
                    }
                }

                await using var conn = await db.OpenConnectionAsync();
                await using var tx = await conn.BeginTransactionAsync();

                const string existsSql = "select 1 from orders where order_id = @order_id limit 1;";
                await using (var existsCmd = new NpgsqlCommand(existsSql, conn, tx))
                {
                    existsCmd.Parameters.AddWithValue("order_id", orderId);
                    if (await existsCmd.ExecuteScalarAsync() is null)
                    {
                        await tx.RollbackAsync();
                        return Results.NotFound(new { error = "Order not found." });
                    }
                }

                const string deleteSql = "delete from order_payments where order_id = @order_id;";
                await using (var deleteCmd = new NpgsqlCommand(deleteSql, conn, tx))
                {
                    deleteCmd.Parameters.AddWithValue("order_id", orderId);
                    await deleteCmd.ExecuteNonQueryAsync();
                }

                const string insertSql = @"
insert into order_payments
  (order_id, split_index, method, base_amount_cents, tip_cents, total_amount_cents,
   received_cents, change_cents, card_entry_mode, acquirer, reference)
values
  (@order_id, @split_index, @method, @base_amount_cents, @tip_cents, @total_amount_cents,
   @received_cents, @change_cents, @card_entry_mode, @acquirer, @reference);";

                foreach (var payment in payments)
                {
                    await using var insertCmd = new NpgsqlCommand(insertSql, conn, tx);
                    insertCmd.Parameters.AddWithValue("order_id", orderId);
                    insertCmd.Parameters.AddWithValue("split_index", payment.SplitIndex);
                    insertCmd.Parameters.AddWithValue("method", payment.Method);
                    insertCmd.Parameters.AddWithValue("base_amount_cents", payment.BaseAmountCents);
                    insertCmd.Parameters.AddWithValue("tip_cents", payment.TipCents);
                    insertCmd.Parameters.AddWithValue("total_amount_cents", payment.TotalAmountCents);
                    insertCmd.Parameters.AddWithValue("received_cents", (object?)payment.ReceivedCents ?? DBNull.Value);
                    insertCmd.Parameters.AddWithValue("change_cents", (object?)payment.ChangeCents ?? DBNull.Value);
                    insertCmd.Parameters.AddWithValue("card_entry_mode", (object?)payment.CardEntryMode ?? DBNull.Value);
                    insertCmd.Parameters.AddWithValue("acquirer", (object?)payment.Acquirer ?? DBNull.Value);
                    insertCmd.Parameters.AddWithValue("reference", (object?)payment.Reference ?? DBNull.Value);
                    await insertCmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();

                return Results.Json(
                    new { ok = true, count = payments.Count },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PUT /api/orders/{orderId}/payments:\n" + ex);
                return Results.Problem("PUT /api/orders/{orderId}/payments failed", statusCode: 500);
            }
        });

        // GET /api/orders/active?shiftId=<guid>&tableId=<guid?>   (tableId is optional)
        app.MapGet("/api/orders/active", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            if (!Guid.TryParse(req.Query["shiftId"], out var shiftId))
                return Results.BadRequest("shiftId is required and must be a GUID.");

            Guid? tableId = null;
            if (req.Query.TryGetValue("tableId", out var raw) && Guid.TryParse(raw!, out var tId))
                tableId = tId;

            int? tableNum = null;
            if (req.Query.TryGetValue("tableNum", out var rawNum))
            {
                if (int.TryParse(rawNum!, out var n)) tableNum = n;
            }

            var tableString = req.Query.TryGetValue("table", out var rawTable) ? rawTable.ToString() : null;
            if (tableNum is null && !string.IsNullOrWhiteSpace(tableString) && !tableString.Equals("none", StringComparison.OrdinalIgnoreCase))
            {
                if (int.TryParse(tableString, out var n2)) tableNum = n2;
            }

            try
            {
                await using var conn = await db.OpenConnectionAsync();

                /* Resolve tableNum -> tableId (same critical fix) */
                if (tableId is null && tableNum is not null)
                {
                    const string TABLE_LOOKUP = @"
                select table_id
                from tables
                where table_number = @table_number
                limit 1;";

                    await using var tcmd = new NpgsqlCommand(TABLE_LOOKUP, conn);
                    tcmd.Parameters.AddWithValue("table_number", tableNum.Value);

                    var res = await tcmd.ExecuteScalarAsync();
                    if (res is Guid g) tableId = g;
                    else
                    {
                        return Results.BadRequest($"Unknown table_number {tableNum}.");
                    }
                }

                Guid? orderId = null;

                if (tableId is null)
                {
                    /* Safety rule:
                       If caller didn't specify a table, DON'T return the shared NULL-table order by accident.
                       Only return quick order if they explicitly asked for table=none.
                    */
                    if (!string.IsNullOrWhiteSpace(tableString) && tableString.Equals("none", StringComparison.OrdinalIgnoreCase))
                    {
                        const string FIND_QUICK = @"
                    select order_id
                    from orders
                    where shift_id = @shift_id
                      and table_id is null
                      and status = 'open'
                      and source = 'quick'
                    limit 1;";

                        await using var find = new NpgsqlCommand(FIND_QUICK, conn);
                        find.Parameters.AddWithValue("shift_id", shiftId);

                        var res = await find.ExecuteScalarAsync();
                        if (res is Guid g) orderId = g;
                    }
                    else
                    {
                        return Results.Json(new ActiveOrderDto(), new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                    }
                }
                else
                {
                    const string FIND_TABLE = @"
                select o.order_id
                from orders o
                where o.shift_id = @shift_id
                  and o.table_id = @table_id
                  and o.status = 'open'
                limit 1;";

                    await using var find = new NpgsqlCommand(FIND_TABLE, conn);
                    find.Parameters.AddWithValue("shift_id", shiftId);
                    find.Parameters.AddWithValue("table_id", tableId.Value);

                    var res = await find.ExecuteScalarAsync();
                    if (res is Guid g) orderId = g;
                }

                if (orderId is null)
                {
                    return Results.Json(new ActiveOrderDto(), new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                }
                const string ITEMS_SQL = @"
    select
      oi.order_item_id,
      oi.product_id,
      coalesce(p.name, '[missing product]') as name,
      oi.quantity,
      oi.price_cents,
      oi.item_status,
      oi.cancel_request_status
    from order_items oi
    left join products p on p.product_id = oi.product_id
    where oi.order_id = @order_id
    order by oi.created_at;
";

                var items = new List<ActiveOrderItemDto>();
                await using (var itemsCmd = new NpgsqlCommand(ITEMS_SQL, conn))
                {
                    itemsCmd.Parameters.AddWithValue("order_id", orderId.Value);
                    await using var r = await itemsCmd.ExecuteReaderAsync();
                    while (await r.ReadAsync())
                    {
                        items.Add(new ActiveOrderItemDto
                        {
                            OrderItemId = r.GetGuid(0),
                            ProductId = r.GetGuid(1),
                            Name = r.GetString(2),
                            Qty = r.GetInt32(3),
                            UnitPrice = r.GetInt32(4) / 100m,
                            ItemStatus = r.GetString(5),
                            CancelRequestStatus = r.IsDBNull(6) ? "none" : r.GetString(6)
                        });
                    }
                }

                return Results.Json(
                    new ActiveOrderDto { OrderId = orderId, Items = items },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/orders/active:\n" + ex);
                return Results.Problem("GET /api/orders/active failed", statusCode: 500);
            }
        });

        app.MapPost("/api/orders/items/{orderItemId:guid}/cancel-request", async (Guid orderItemId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
update order_items
   set cancel_request_status = 'requested',
       cancel_requested_at = now(),
       cancel_decided_at = null
 where order_item_id = @order_item_id
   and item_status <> 'cancelled'
   and cancel_request_status in ('none', 'rejected')
returning order_item_id;";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_item_id", orderItemId);

                var updated = await cmd.ExecuteScalarAsync();
                if (updated is null)
                {
                    return Results.BadRequest(new { error = "Item cannot request cancellation." });
                }

                return Results.Json(new { ok = true, orderItemId }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in POST /api/orders/items/{orderItemId}/cancel-request:\n" + ex);
                return Results.Problem("Failed to request item cancellation.", statusCode: 500);
            }
        });

        app.MapGet("/api/shifts/{shiftId:guid}/cancel-requests", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
select
  oi.order_item_id,
  o.order_id,
  oi.product_id,
  coalesce(p.name, '[missing product]') as product_name,
  oi.quantity,
  case
    when o.guest_name is not null and length(btrim(o.guest_name)) > 0 then o.guest_name
    when t.table_number is not null then 'Table ' || t.table_number::text
    else 'Quick'
  end as source_label,
  oi.cancel_requested_at
from order_items oi
join orders o on o.order_id = oi.order_id
left join tables t on t.table_id = o.table_id
left join products p on p.product_id = oi.product_id
where o.shift_id = @shift_id
  and o.status = 'open'
  and oi.cancel_request_status = 'requested'
order by oi.cancel_requested_at, oi.created_at;";

                var rows = new List<OrderCancelRequestDto>();
                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    rows.Add(new OrderCancelRequestDto
                    {
                        OrderItemId = reader.GetGuid(0),
                        OrderId = reader.GetGuid(1),
                        ProductId = reader.GetGuid(2),
                        ProductName = reader.GetString(3),
                        Quantity = reader.GetInt32(4),
                        SourceLabel = reader.GetString(5),
                        RequestedAt = reader.GetFieldValue<DateTimeOffset>(6)
                    });
                }

                return Results.Json(rows, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/cancel-requests:\n" + ex);
                return Results.Problem("Failed to load cancel requests.", statusCode: 500);
            }
        });

        app.MapPatch("/api/orders/items/{orderItemId:guid}/cancel-request", async (Guid orderItemId, DecideOrderCancelRequest payload, NpgsqlDataSource db) =>
        {
            try
            {
                const string sql = @"
update order_items
   set cancel_request_status = case when @approved then 'approved' else 'rejected' end,
       cancel_decided_at = now(),
       item_status = case when @approved then 'cancelled' else item_status end
 where order_item_id = @order_item_id
   and cancel_request_status = 'requested'
returning order_item_id;";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("order_item_id", orderItemId);
                cmd.Parameters.AddWithValue("approved", payload.Approved);

                var updated = await cmd.ExecuteScalarAsync();
                if (updated is null)
                {
                    return Results.NotFound(new { error = "Cancel request not found." });
                }

                return Results.Json(
                    new { ok = true, orderItemId, approved = payload.Approved },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in PATCH /api/orders/items/{orderItemId}/cancel-request:\n" + ex);
                return Results.Problem("Failed to decide cancel request.", statusCode: 500);
            }
        });





    }




    /* ==========================
       Small helper methods
       ========================== */

    private static string? GetString(JsonElement obj, string name)
    {
        return obj.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String
            ? p.GetString()
            : null;
    }

    private static int? GetInt(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out var p)) return null;
        if (p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var i)) return i;
        return null;
    }

    private static DateTime? GetDateTime(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out var p)) return null;
        if (p.ValueKind == JsonValueKind.String &&
            DateTime.TryParse(p.GetString(), out var dt))
        {
            return dt;
        }
        return null;
    }

    private static bool TryGetGuid(JsonElement obj, string name, out Guid value)
    {
        value = Guid.Empty;
        if (!obj.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.String)
            return false;
        return Guid.TryParse(p.GetString(), out value);
    }
}
