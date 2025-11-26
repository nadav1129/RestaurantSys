using System.Text.Json;
using Npgsql;

namespace RestaurantSys.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this WebApplication app)
    {
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
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/orders:\n" + ex);
                return Results.Problem("GET /api/shifts/{shiftId}/orders failed", statusCode: 500);
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

                var source = GetString(body, "source")?.Trim();
                if (string.IsNullOrEmpty(source))
                    source = "table";

                var guestName = GetString(body, "guestName");
                var guestPhone = GetString(body, "guestPhone");
                var dinersCount = GetInt(body, "dinersCount");
                var note = GetString(body, "note");
                var minSpend = GetInt(body, "minSpendCents");

                const string sql = @"
                    insert into orders
                      (shift_id, table_id, opened_by_worker_id, source, status,
                       opened_at, guest_name, guest_phone, diners_count, note,
                       min_spend_cents)
                    values
                      (@shift_id, @table_id, @opened_by_worker_id, @source, 'open',
                       now(), @guest_name, @guest_phone, @diners_count, @note,
                       @min_spend_cents)
                    returning
                      order_id, shift_id, table_id, source, status, opened_at,
                      guest_name, guest_phone, diners_count, note, min_spend_cents;
                ";

                await using var cmd = db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("shift_id", shiftId);
                cmd.Parameters.AddWithValue("table_id", (object?)tableId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("opened_by_worker_id", (object?)openedByWorkerId ?? DBNull.Value);
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
