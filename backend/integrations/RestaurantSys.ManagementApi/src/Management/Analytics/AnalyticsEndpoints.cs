using System.Globalization;
using System.Text.Json;
using Npgsql;
using RestaurantSys.Api;

namespace RestaurantSys.Api.Endpoints;

public static class AnalyticsEndpoints
{
    private const string BusinessTimeZone = "Asia/Jerusalem";

    private const string RevenueOrdersCte = """
        with payment_rollup as (
          select
            order_id,
            coalesce(sum(total_amount_cents), 0) as payment_total_cents
          from order_payments
          group by order_id
        ),
        revenue_orders as (
          select
            o.order_id,
            timezone('Asia/Jerusalem', coalesce(o.closed_at, o.created_at)) as local_ts,
            timezone('Asia/Jerusalem', coalesce(o.closed_at, o.created_at))::date as local_date,
            coalesce(o.paid_cents, pr.payment_total_cents, o.total_cents, 0) as revenue_cents
          from orders o
          left join payment_rollup pr on pr.order_id = o.order_id
          where o.status = 'closed'
            and o.payment_status = 'paid'
            and coalesce(o.closed_at, o.created_at) is not null
        )
        """;

    public static void MapAnalyticsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/analytics/strategic", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            try
            {
                var rangeDays = ParseRangeDays(req.Query["days"]);
                var dto = new StrategicAnalyticsDto
                {
                    SelectedRangeDays = rangeDays,
                    GeneratedAt = DateTime.UtcNow
                };

                const string summarySql = RevenueOrdersCte + """
                    , bounds as (
                      select
                        timezone('Asia/Jerusalem', now()) as local_now,
                        date_trunc('day', timezone('Asia/Jerusalem', now())) as today_start,
                        date_trunc('week', timezone('Asia/Jerusalem', now())) as week_start,
                        date_trunc('month', timezone('Asia/Jerusalem', now())) as month_start,
                        date_trunc('day', timezone('Asia/Jerusalem', now()))
                          - make_interval(days => greatest(@range_days - 1, 0)) as range_start
                    )
                    select
                      coalesce(sum(case when ro.local_ts >= b.today_start then ro.revenue_cents else 0 end), 0) as revenue_today_cents,
                      coalesce(sum(case when ro.local_ts >= b.week_start then ro.revenue_cents else 0 end), 0) as revenue_this_week_cents,
                      coalesce(sum(case when ro.local_ts >= b.week_start - interval '7 days' and ro.local_ts < b.week_start then ro.revenue_cents else 0 end), 0) as revenue_last_week_cents,
                      coalesce(sum(case when ro.local_ts >= b.month_start then ro.revenue_cents else 0 end), 0) as revenue_this_month_cents,
                      coalesce(sum(case when ro.local_ts >= b.month_start - interval '1 month' and ro.local_ts < b.month_start then ro.revenue_cents else 0 end), 0) as revenue_last_month_cents,
                      coalesce(sum(case when ro.local_ts >= b.range_start then ro.revenue_cents else 0 end), 0) as revenue_in_range_cents,
                      count(*) filter (where ro.local_ts >= b.range_start) as order_count_in_range
                    from revenue_orders ro
                    cross join bounds b;
                    """;

                await using (var cmd = db.CreateCommand(summarySql))
                {
                    cmd.Parameters.AddWithValue("range_days", rangeDays);
                    await using var reader = await cmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        dto.RevenueTodayCents = Convert.ToInt32(reader.GetValue(0));
                        dto.RevenueThisWeekCents = Convert.ToInt32(reader.GetValue(1));
                        dto.RevenueLastWeekCents = Convert.ToInt32(reader.GetValue(2));
                        dto.RevenueThisMonthCents = Convert.ToInt32(reader.GetValue(3));
                        dto.RevenueLastMonthCents = Convert.ToInt32(reader.GetValue(4));
                        dto.RevenueInSelectedRangeCents = Convert.ToInt32(reader.GetValue(5));
                        dto.OrderCountInSelectedRange = Convert.ToInt32(reader.GetValue(6));
                    }
                }

                dto.AverageDailyRevenueCents = rangeDays > 0
                    ? dto.RevenueInSelectedRangeCents / rangeDays
                    : 0;
                dto.AverageOrderValueCents = dto.OrderCountInSelectedRange > 0
                    ? dto.RevenueInSelectedRangeCents / dto.OrderCountInSelectedRange
                    : 0;
                dto.WeekOverWeekChangePercent = ComputeChangePercent(
                    dto.RevenueThisWeekCents,
                    dto.RevenueLastWeekCents
                );
                dto.MonthOverMonthChangePercent = ComputeChangePercent(
                    dto.RevenueThisMonthCents,
                    dto.RevenueLastMonthCents
                );

                const string dailySql = RevenueOrdersCte + """
                    , bounds as (
                      select
                        (date_trunc('day', timezone('Asia/Jerusalem', now()))
                          - make_interval(days => greatest(@range_days - 1, 0)))::date as range_start_date,
                        date_trunc('day', timezone('Asia/Jerusalem', now()))::date as range_end_date
                    ),
                    daily_totals as (
                      select
                        local_date,
                        sum(revenue_cents) as revenue_cents,
                        count(*) as order_count
                      from revenue_orders
                      group by local_date
                    )
                    select
                      gs.bucket_date,
                      coalesce(dt.revenue_cents, 0) as revenue_cents,
                      coalesce(dt.order_count, 0) as order_count
                    from bounds b
                    cross join lateral generate_series(
                      b.range_start_date,
                      b.range_end_date,
                      interval '1 day'
                    ) as gs(bucket_date)
                    left join daily_totals dt on dt.local_date = gs.bucket_date::date
                    order by gs.bucket_date;
                    """;

                await using (var cmd = db.CreateCommand(dailySql))
                {
                    cmd.Parameters.AddWithValue("range_days", rangeDays);
                    await using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var bucketDate = reader.GetDateTime(0);
                        dto.DailyRevenueSeries.Add(new RevenueSeriesPointDto
                        {
                            Key = bucketDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                            Label = bucketDate.ToString("dd MMM", CultureInfo.InvariantCulture),
                            RevenueCents = Convert.ToInt32(reader.GetValue(1)),
                            OrderCount = Convert.ToInt32(reader.GetValue(2))
                        });
                    }
                }

                const string weeklySql = RevenueOrdersCte + """
                    , bounds as (
                      select
                        (date_trunc('week', timezone('Asia/Jerusalem', now())) - interval '11 weeks')::date as range_start_date,
                        date_trunc('week', timezone('Asia/Jerusalem', now()))::date as range_end_date
                    ),
                    weekly_totals as (
                      select
                        date_trunc('week', local_ts)::date as bucket_date,
                        sum(revenue_cents) as revenue_cents,
                        count(*) as order_count
                      from revenue_orders
                      group by date_trunc('week', local_ts)::date
                    )
                    select
                      gs.bucket_date,
                      coalesce(wt.revenue_cents, 0) as revenue_cents,
                      coalesce(wt.order_count, 0) as order_count
                    from bounds b
                    cross join lateral generate_series(
                      b.range_start_date,
                      b.range_end_date,
                      interval '1 week'
                    ) as gs(bucket_date)
                    left join weekly_totals wt on wt.bucket_date = gs.bucket_date::date
                    order by gs.bucket_date;
                    """;

                await using (var cmd = db.CreateCommand(weeklySql))
                {
                    await using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var bucketDate = reader.GetDateTime(0);
                        dto.WeeklyRevenueSeries.Add(new RevenueSeriesPointDto
                        {
                            Key = bucketDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                            Label = $"Week of {bucketDate.ToString("dd MMM", CultureInfo.InvariantCulture)}",
                            RevenueCents = Convert.ToInt32(reader.GetValue(1)),
                            OrderCount = Convert.ToInt32(reader.GetValue(2))
                        });
                    }
                }

                const string monthlySql = RevenueOrdersCte + """
                    , bounds as (
                      select
                        date_trunc('month', timezone('Asia/Jerusalem', now())) - interval '11 months' as range_start_date,
                        date_trunc('month', timezone('Asia/Jerusalem', now())) as range_end_date
                    ),
                    monthly_totals as (
                      select
                        date_trunc('month', local_ts)::date as bucket_date,
                        sum(revenue_cents) as revenue_cents,
                        count(*) as order_count
                      from revenue_orders
                      group by date_trunc('month', local_ts)::date
                    )
                    select
                      gs.bucket_date,
                      coalesce(mt.revenue_cents, 0) as revenue_cents,
                      coalesce(mt.order_count, 0) as order_count
                    from bounds b
                    cross join lateral generate_series(
                      b.range_start_date,
                      b.range_end_date,
                      interval '1 month'
                    ) as gs(bucket_date)
                    left join monthly_totals mt on mt.bucket_date = gs.bucket_date::date
                    order by gs.bucket_date;
                    """;

                await using (var cmd = db.CreateCommand(monthlySql))
                {
                    await using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var bucketDate = reader.GetDateTime(0);
                        dto.MonthlyRevenueSeries.Add(new RevenueSeriesPointDto
                        {
                            Key = bucketDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                            Label = bucketDate.ToString("MMM yyyy", CultureInfo.InvariantCulture),
                            RevenueCents = Convert.ToInt32(reader.GetValue(1)),
                            OrderCount = Convert.ToInt32(reader.GetValue(2))
                        });
                    }
                }

                return Results.Json(
                    dto,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    }
                );
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error in GET /api/analytics/strategic:\n" + ex);
                return Results.Problem("Failed to load strategic analytics.", statusCode: 500);
            }
        });
    }

    private static int ParseRangeDays(string? raw)
    {
        if (!int.TryParse(raw, out var parsed))
            return 90;

        return parsed switch
        {
            30 => 30,
            90 => 90,
            180 => 180,
            365 => 365,
            _ => 90
        };
    }

    private static decimal? ComputeChangePercent(int current, int previous)
    {
        if (previous == 0)
        {
            return current == 0 ? 0m : null;
        }

        return Math.Round(((decimal)(current - previous) / previous) * 100m, 1);
    }
}
