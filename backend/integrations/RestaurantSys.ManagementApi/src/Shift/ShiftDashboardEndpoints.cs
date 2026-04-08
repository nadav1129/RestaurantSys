using System.Text.Json;
using Npgsql;
using RestaurantSys.Api;

namespace RestaurantSys.Api.Endpoints;

public static class ShiftDashboardEndpoints
{
    public static void MapShiftDashboardEndpoints(this WebApplication app)
    {
        var jsonOptionsCamel = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        app.MapGet("/api/shifts/{shiftId:guid}/dashboard", async (Guid shiftId, NpgsqlDataSource db) =>
        {
            try
            {
                const string shiftSql = @"
                    select status
                    from shifts
                    where shift_id = @shift_id
                    limit 1;
                ";

                string? shiftStatus;
                await using (var shiftCmd = db.CreateCommand(shiftSql))
                {
                    shiftCmd.Parameters.AddWithValue("shift_id", shiftId);
                    shiftStatus = await shiftCmd.ExecuteScalarAsync() as string;
                }

                if (shiftStatus is null)
                {
                    return Results.NotFound(new { error = "Shift not found." });
                }

                var dto = new ShiftDashboardDto();

                if (string.Equals(shiftStatus, "active", StringComparison.OrdinalIgnoreCase))
                {
                    const string guestSql = @"
                        select current_guest_count
                        from public.management_settings
                        where id = 1
                        limit 1;
                    ";

                    await using var guestCmd = db.CreateCommand(guestSql);
                    var guestValue = await guestCmd.ExecuteScalarAsync();
                    dto.Summary.CurrentGuestCount = guestValue is null or DBNull
                        ? 0
                        : Convert.ToInt32(guestValue);
                }

                const string ordersSummarySql = @"
                    select
                      coalesce(sum(coalesce(total_cents, 0)), 0) as total_income_cents,
                      coalesce(sum(coalesce(tip_cents, 0)), 0) as total_tips_cents,
                      count(*) filter (where status = 'open') as open_orders_count,
                      count(distinct table_id) filter (where status = 'open' and table_id is not null) as open_tables_count
                    from orders
                    where shift_id = @shift_id
                      and status <> 'cancelled';
                ";

                await using (var summaryCmd = db.CreateCommand(ordersSummarySql))
                {
                    summaryCmd.Parameters.AddWithValue("shift_id", shiftId);
                    await using var reader = await summaryCmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        dto.Summary.TotalIncomeCents = Convert.ToInt32(reader.GetValue(0));
                        dto.Summary.TotalTipsCents = Convert.ToInt32(reader.GetValue(1));
                        dto.Summary.OpenOrdersCount = Convert.ToInt32(reader.GetValue(2));
                        dto.Summary.OpenTablesCount = Convert.ToInt32(reader.GetValue(3));
                    }
                }

                const string itemsSummarySql = @"
                    select
                      coalesce(sum(case when oi.item_status in ('pending', 'in_progress') then oi.quantity else 0 end), 0) as pending_items_count,
                      coalesce(sum(case when oi.item_status = 'ready' then oi.quantity else 0 end), 0) as ready_items_count,
                      count(*) filter (where oi.cancel_request_status = 'requested') as cancel_requests_count
                    from order_items oi
                    join orders o on o.order_id = oi.order_id
                    where o.shift_id = @shift_id
                      and o.status = 'open'
                      and oi.item_status <> 'cancelled';
                ";

                await using (var itemsCmd = db.CreateCommand(itemsSummarySql))
                {
                    itemsCmd.Parameters.AddWithValue("shift_id", shiftId);
                    await using var reader = await itemsCmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        dto.Summary.PendingItemsCount = Convert.ToInt32(reader.GetValue(0));
                        dto.Summary.ReadyItemsCount = Convert.ToInt32(reader.GetValue(1));
                        dto.Summary.CancelRequestsCount = Convert.ToInt32(reader.GetValue(2));
                    }
                }

                const string staffSql = @"
                    select
                      sw.shift_worker_id,
                      sw.worker_id,
                      trim(concat_ws(' ', w.first_name, w.last_name)) as worker_name,
                      sw.position_snapshot,
                      s.station_name,
                      sw.device_type,
                      sw.started_at,
                      coalesce(round(extract(epoch from now() - sw.started_at) / 60.0), 0) as minutes_on_shift
                    from shift_workers sw
                    join workers w on w.worker_id = sw.worker_id
                    left join stations s on s.station_id = sw.station_id
                    where sw.shift_id = @shift_id
                      and sw.ended_at is null
                    order by sw.started_at;
                ";

                await using (var staffCmd = db.CreateCommand(staffSql))
                {
                    staffCmd.Parameters.AddWithValue("shift_id", shiftId);
                    await using var reader = await staffCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        dto.Staff.Add(new DashboardStaffDto
                        {
                            ShiftWorkerId = reader.GetGuid(0),
                            WorkerId = reader.GetGuid(1),
                            Name = reader.IsDBNull(2) ? "Unnamed worker" : reader.GetString(2),
                            Position = reader.IsDBNull(3) ? "Worker" : reader.GetString(3),
                            StationName = reader.IsDBNull(4) ? null : reader.GetString(4),
                            DeviceType = reader.IsDBNull(5) ? "fixed" : reader.GetString(5),
                            StartedAt = reader.GetDateTime(6),
                            MinutesOnShift = Convert.ToInt32(reader.GetValue(7))
                        });
                    }
                }

                dto.Summary.ActiveStaffCount = dto.Staff.Count;

                const string tablesSql = @"
                    select
                      o.order_id,
                      o.table_id,
                      t.table_number,
                      coalesce(nullif(btrim(o.guest_name), ''), 'Walk-in') as guest_label,
                      o.diners_count,
                      o.opened_at,
                      coalesce(round(extract(epoch from now() - o.opened_at) / 60.0), 0) as minutes_open,
                      coalesce(sum(case when oi.item_status <> 'cancelled' then oi.quantity * oi.price_cents else 0 end), 0) as current_total_cents,
                      o.payment_status,
                      o.source
                    from orders o
                    join tables t on t.table_id = o.table_id
                    left join order_items oi on oi.order_id = o.order_id
                    where o.shift_id = @shift_id
                      and o.status = 'open'
                      and o.table_id is not null
                    group by
                      o.order_id,
                      o.table_id,
                      t.table_number,
                      guest_label,
                      o.diners_count,
                      o.opened_at,
                      o.payment_status,
                      o.source
                    order by t.table_number;
                ";

                await using (var tablesCmd = db.CreateCommand(tablesSql))
                {
                    tablesCmd.Parameters.AddWithValue("shift_id", shiftId);
                    await using var reader = await tablesCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        dto.Tables.Add(new DashboardTableDto
                        {
                            OrderId = reader.GetGuid(0),
                            TableId = reader.GetGuid(1),
                            TableNumber = reader.GetInt32(2),
                            GuestLabel = reader.GetString(3),
                            DinersCount = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4),
                            OpenedAt = reader.GetDateTime(5),
                            MinutesOpen = Convert.ToInt32(reader.GetValue(6)),
                            CurrentTotalCents = Convert.ToInt32(reader.GetValue(7)),
                            PaymentStatus = reader.IsDBNull(8) ? "unpaid" : reader.GetString(8),
                            Source = reader.IsDBNull(9) ? "table" : reader.GetString(9)
                        });
                    }
                }

                const string queuesSql = @"
                    select
                      coalesce(s.station_id::text, o.source) as queue_id,
                      coalesce(nullif(btrim(s.station_name), ''), initcap(replace(o.source, '_', ' '))) as queue_label,
                      coalesce(nullif(btrim(s.station_type), ''), initcap(replace(o.source, '_', ' '))) as station_type,
                      count(distinct o.order_id) as open_orders,
                      coalesce(sum(case when oi.item_status in ('pending', 'in_progress') then oi.quantity else 0 end), 0) as pending_items,
                      coalesce(sum(case when oi.item_status = 'ready' then oi.quantity else 0 end), 0) as ready_items,
                      coalesce(round(avg(extract(epoch from now() - o.opened_at) / 60.0)), 0) as average_age_minutes
                    from orders o
                    left join stations s on s.station_id = o.origin_station_id
                    left join order_items oi on oi.order_id = o.order_id and oi.item_status <> 'cancelled'
                    where o.shift_id = @shift_id
                      and o.status = 'open'
                    group by
                      coalesce(s.station_id::text, o.source),
                      coalesce(nullif(btrim(s.station_name), ''), initcap(replace(o.source, '_', ' '))),
                      coalesce(nullif(btrim(s.station_type), ''), initcap(replace(o.source, '_', ' ')))
                    order by open_orders desc, pending_items desc, queue_label;
                ";

                await using (var queuesCmd = db.CreateCommand(queuesSql))
                {
                    queuesCmd.Parameters.AddWithValue("shift_id", shiftId);
                    await using var reader = await queuesCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        dto.Queues.Add(new DashboardQueueDto
                        {
                            QueueId = reader.GetString(0),
                            Label = reader.GetString(1),
                            StationType = reader.GetString(2),
                            OpenOrders = Convert.ToInt32(reader.GetValue(3)),
                            PendingItems = Convert.ToInt32(reader.GetValue(4)),
                            ReadyItems = Convert.ToInt32(reader.GetValue(5)),
                            AverageAgeMinutes = Convert.ToInt32(reader.GetValue(6))
                        });
                    }
                }

                const string timelineSql = @"
                    with buckets as (
                      select generate_series(
                        date_trunc('hour', now()) - interval '5 hours',
                        date_trunc('hour', now()),
                        interval '1 hour'
                      ) as bucket_start
                    )
                    select
                      b.bucket_start,
                      count(o.order_id) as orders_count,
                      coalesce(sum(coalesce(o.total_cents, 0)), 0) as revenue_cents
                    from buckets b
                    left join orders o
                      on o.shift_id = @shift_id
                     and date_trunc('hour', o.opened_at) = b.bucket_start
                    group by b.bucket_start
                    order by b.bucket_start;
                ";

                await using (var timelineCmd = db.CreateCommand(timelineSql))
                {
                    timelineCmd.Parameters.AddWithValue("shift_id", shiftId);
                    await using var reader = await timelineCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var bucketStart = reader.GetDateTime(0);
                        dto.RevenueTimeline.Add(new DashboardTrendPointDto
                        {
                            Label = bucketStart.ToString("HH:mm"),
                            OrdersCount = Convert.ToInt32(reader.GetValue(1)),
                            RevenueCents = Convert.ToInt32(reader.GetValue(2))
                        });
                    }
                }

                return Results.Json(dto, jsonOptionsCamel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/shifts/{shiftId}/dashboard:\n" + ex);
                return Results.Problem("Failed to load shift dashboard.", statusCode: 500);
            }
        });
    }
}
