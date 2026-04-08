import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/api";
import Button from "../../components/Button";
import {
  AnalyticsIcon,
  ClockIcon,
  OrdersIcon,
  RevenueCenterIcon,
} from "../../components/icons";
import {
  EmptyState,
  SectionCard,
  StatCard,
} from "../../components/ui/layout";
import { cn } from "../../lib/utils";
import { formatMoney } from "../../utils/money";

type RangeDays = 30 | 90 | 180 | 365;
type ChartMode = "daily" | "weekly" | "monthly";

type RevenueSeriesPointDto = {
  key: string;
  label: string;
  revenueCents: number;
  orderCount: number;
};

type StrategicAnalyticsDto = {
  selectedRangeDays: number;
  generatedAt: string;
  revenueTodayCents: number;
  revenueThisWeekCents: number;
  revenueLastWeekCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  weekOverWeekChangePercent: number | null;
  monthOverMonthChangePercent: number | null;
  revenueInSelectedRangeCents: number;
  averageDailyRevenueCents: number;
  orderCountInSelectedRange: number;
  averageOrderValueCents: number;
  dailyRevenueSeries: RevenueSeriesPointDto[];
  weeklyRevenueSeries: RevenueSeriesPointDto[];
  monthlyRevenueSeries: RevenueSeriesPointDto[];
};

const RANGE_OPTIONS: Array<{ value: RangeDays; label: string }> = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "12 months" },
];

const emptyAnalytics: StrategicAnalyticsDto = {
  selectedRangeDays: 90,
  generatedAt: new Date(0).toISOString(),
  revenueTodayCents: 0,
  revenueThisWeekCents: 0,
  revenueLastWeekCents: 0,
  revenueThisMonthCents: 0,
  revenueLastMonthCents: 0,
  weekOverWeekChangePercent: 0,
  monthOverMonthChangePercent: 0,
  revenueInSelectedRangeCents: 0,
  averageDailyRevenueCents: 0,
  orderCountInSelectedRange: 0,
  averageOrderValueCents: 0,
  dailyRevenueSeries: [],
  weeklyRevenueSeries: [],
  monthlyRevenueSeries: [],
};

function formatCurrency(cents: number) {
  return `NIS ${formatMoney(cents / 100)}`;
}

function formatPercent(value: number | null) {
  if (value == null) return "New activity";
  if (value === 0) return "Flat";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value)}%`;
}

function getChangeTone(value: number | null): "default" | "success" | "warning" {
  if (value == null) return "default";
  if (value > 0) return "success";
  if (value < 0) return "warning";
  return "default";
}

function getChangeLabel(value: number | null, previousCents: number) {
  if (value == null) {
    return previousCents > 0 ? "No previous baseline" : "First recorded period";
  }

  if (value > 0) return "Improving";
  if (value < 0) return "Below previous period";
  return "Matching previous period";
}

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState<RangeDays>(90);
  const [chartMode, setChartMode] = useState<ChartMode>("daily");
  const [chartWindowStart, setChartWindowStart] = useState(0);
  const [analytics, setAnalytics] = useState<StrategicAnalyticsDto>(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = (await apiFetch("/api/analytics/strategic", {
          query: { days: rangeDays },
        })) as StrategicAnalyticsDto | null;

        if (!cancelled) {
          setAnalytics(data ?? { ...emptyAnalytics, selectedRangeDays: rangeDays });
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
        if (!cancelled) setError("Failed to load analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [rangeDays]);

  const activeSeries = useMemo(() => {
    if (chartMode === "weekly") return analytics.weeklyRevenueSeries;
    if (chartMode === "monthly") return analytics.monthlyRevenueSeries;
    return analytics.dailyRevenueSeries;
  }, [analytics.dailyRevenueSeries, analytics.monthlyRevenueSeries, analytics.weeklyRevenueSeries, chartMode]);

  const visiblePointCount = useMemo(() => {
    if (chartMode === "monthly") return 12;
    if (chartMode === "weekly") return 10;
    if (rangeDays >= 180) return 18;
    if (rangeDays >= 90) return 14;
    return 12;
  }, [chartMode, rangeDays]);

  const maxWindowStart = Math.max(0, activeSeries.length - visiblePointCount);

  useEffect(() => {
    setChartWindowStart(maxWindowStart);
  }, [maxWindowStart, chartMode, rangeDays]);

  const visibleSeries = useMemo(
    () =>
      activeSeries.slice(
        chartWindowStart,
        chartWindowStart + visiblePointCount
      ),
    [activeSeries, chartWindowStart, visiblePointCount]
  );

  const maxRevenue = useMemo(
    () => Math.max(1, ...visibleSeries.map((point) => point.revenueCents)),
    [visibleSeries]
  );

  const recentRows = useMemo(
    () => activeSeries.slice(Math.max(activeSeries.length - 8, 0)).reverse(),
    [activeSeries]
  );

  const hasAnyRevenue =
    analytics.revenueTodayCents > 0 ||
    analytics.revenueThisWeekCents > 0 ||
    analytics.revenueThisMonthCents > 0 ||
    analytics.revenueInSelectedRangeCents > 0;

  const weekTone = getChangeTone(analytics.weekOverWeekChangePercent);
  const monthTone = getChangeTone(analytics.monthOverMonthChangePercent);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Strategic Analytics"
        description="Management revenue signals based on finalized paid orders, designed for business decisions rather than shift monitoring."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={rangeDays === option.value ? "primary" : "secondary"}
                onClick={() => setRangeDays(option.value)}
                disabled={loading}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenue Today"
            value={loading ? "--" : formatCurrency(analytics.revenueTodayCents)}
            hint="Finalized revenue recognized today."
          />
          <StatCard
            label="Revenue This Week"
            value={loading ? "--" : formatCurrency(analytics.revenueThisWeekCents)}
            hint={`${formatPercent(analytics.weekOverWeekChangePercent)} vs last week`}
            tone={weekTone === "success" ? "success" : weekTone === "warning" ? "warning" : "default"}
          />
          <StatCard
            label="Revenue This Month"
            value={loading ? "--" : formatCurrency(analytics.revenueThisMonthCents)}
            hint={`${formatPercent(analytics.monthOverMonthChangePercent)} vs last month`}
            tone={monthTone === "success" ? "success" : monthTone === "warning" ? "warning" : "default"}
          />
          <StatCard
            label="Average Order Value"
            value={loading ? "--" : formatCurrency(analytics.averageOrderValueCents)}
            hint={`${analytics.orderCountInSelectedRange} paid orders in the selected range.`}
          />
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard
          title="Revenue Trend"
          description="Use the series view to compare short-term movement against broader weekly and monthly direction."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {(["daily", "weekly", "monthly"] as ChartMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={chartMode === mode ? "primary" : "secondary"}
                  onClick={() => setChartMode(mode)}
                  disabled={loading}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>
          }
        >
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {chartMode === "daily"
                    ? `${analytics.selectedRangeDays}-day revenue trend`
                    : chartMode === "weekly"
                    ? "Last 12 weeks"
                    : "Last 12 months"}
                </div>
                <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Revenue from paid, closed orders grouped in business time.
                </div>
              </div>
              <div className="rs-pill">
                <ClockIcon className="h-4 w-4" />
                Updated {loading ? "..." : new Date(analytics.generatedAt).toLocaleTimeString()}
              </div>
            </div>

            {activeSeries.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
                Trend data will appear once paid orders are available.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="h-[320px] rounded-[24px] border border-[var(--border)] bg-[var(--card)] px-4 py-4">
                  <div
                    className="grid h-full items-end gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(
                        visibleSeries.length,
                        1
                      )}, minmax(0, 1fr))`,
                    }}
                  >
                  {visibleSeries.map((point) => {
                    const height = Math.max(
                      10,
                      Math.round((point.revenueCents / maxRevenue) * 100)
                    );

                    return (
                      <div key={point.key} className="flex h-full flex-col items-center justify-end gap-3">
                        <div className="flex w-full flex-1 flex-col items-center justify-end gap-2">
                          <div
                            className="w-full rounded-t-[20px] bg-gradient-to-t from-[var(--primary)] to-[var(--accent)]"
                            style={{ height: `${height}%` }}
                            title={`${point.label}: ${formatCurrency(point.revenueCents)}`}
                          />
                          <div className="text-[11px] text-[var(--muted-foreground)]">
                            {formatCurrency(point.revenueCents)}
                          </div>
                        </div>
                        <div className="text-center text-[11px] font-medium text-[var(--muted-foreground)]">
                          {point.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                {activeSeries.length > visiblePointCount ? (
                  <div className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-[var(--muted-foreground)]">
                      <span>
                        Showing {chartWindowStart + 1}-
                        {Math.min(chartWindowStart + visiblePointCount, activeSeries.length)} of{" "}
                        {activeSeries.length}
                      </span>
                      <span>
                        {visibleSeries[0]?.label ?? "--"} to{" "}
                        {visibleSeries[visibleSeries.length - 1]?.label ?? "--"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxWindowStart}
                      step={1}
                      value={chartWindowStart}
                      onChange={(e) => setChartWindowStart(Number(e.target.value))}
                      className="rs-range mt-4"
                      aria-label="Revenue chart window"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Comparison Readout"
          description="Quick context for whether the business is moving in the right direction."
        >
          <div className="space-y-3">
            <CompareCard
              title="This week vs last week"
              currentValue={analytics.revenueThisWeekCents}
              previousValue={analytics.revenueLastWeekCents}
              changePercent={analytics.weekOverWeekChangePercent}
              tone={weekTone}
            />
            <CompareCard
              title="This month vs last month"
              currentValue={analytics.revenueThisMonthCents}
              previousValue={analytics.revenueLastMonthCents}
              changePercent={analytics.monthOverMonthChangePercent}
              tone={monthTone}
            />
            <div className="rs-surface-muted p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <AnalyticsIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Selected range average
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Average daily revenue across the current {analytics.selectedRangeDays}-day window.
                  </div>
                </div>
              </div>
              <div className="mt-5 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {formatCurrency(analytics.averageDailyRevenueCents)}
              </div>
            </div>
            <div className="rs-surface-muted p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--card)] text-[var(--foreground)]">
                  <OrdersIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Selected range total
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Finalized revenue and order count over the active range.
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  {formatCurrency(analytics.revenueInSelectedRangeCents)}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {analytics.orderCountInSelectedRange} orders
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Recent Breakdown"
          description="Latest buckets from the active trend view so management can scan the most recent movement."
        >
          <div className="overflow-x-auto rounded-[26px] border border-[var(--border)] bg-[var(--card-muted)]">
            <table className="rs-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                  <th>Average order</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-[var(--muted-foreground)]">
                      No recent analytics data available.
                    </td>
                  </tr>
                ) : (
                  recentRows.map((point) => (
                    <tr key={point.key}>
                      <td className="font-medium text-[var(--foreground)]">{point.label}</td>
                      <td>{formatCurrency(point.revenueCents)}</td>
                      <td>{point.orderCount}</td>
                      <td>
                        {point.orderCount > 0
                          ? formatCurrency(Math.round(point.revenueCents / point.orderCount))
                          : "NIS 0"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Management Notes"
          description="What this screen is measuring and how to interpret it."
        >
          <div className="space-y-3">
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <RevenueCenterIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Revenue basis
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  Strategic analytics count only orders that are both closed and marked paid. Revenue uses the actual paid amount when available, with safe fallback to stored order totals.
                </div>
              </div>
            </div>
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--card)] text-[var(--foreground)]">
                <ClockIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Business time
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  Date grouping is calculated in the restaurant's current business timezone so today, week, and month comparisons stay aligned with local reporting.
                </div>
              </div>
            </div>
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--success-surface)] text-[var(--success)]">
                <OrdersIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Best use
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  This page is meant for management decisions like trend reading, period comparison, and pacing review, not live shift troubleshooting.
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {!loading && !error && !hasAnyRevenue ? (
        <EmptyState
          title="No strategic revenue data yet"
          description="The page is live and connected. Strategic metrics will start populating once orders are completed and marked paid."
        />
      ) : null}
    </div>
  );
}

function CompareCard({
  title,
  currentValue,
  previousValue,
  changePercent,
  tone,
}: {
  title: string;
  currentValue: number;
  previousValue: number;
  changePercent: number | null;
  tone: "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border p-4",
        tone === "success" && "border-[color:var(--success-soft)] bg-[var(--success-surface)]",
        tone === "warning" && "border-[color:var(--warning-soft)] bg-[var(--warning-surface)]",
        tone === "default" && "border-[var(--border)] bg-[var(--card-muted)]"
      )}
    >
      <div className="text-sm font-semibold text-[var(--foreground)]">{title}</div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {formatCurrency(currentValue)}
          </div>
          <div className="mt-1 text-sm text-[var(--muted-foreground)]">
            Previous period: {formatCurrency(previousValue)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-[var(--foreground)]">
            {formatPercent(changePercent)}
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {getChangeLabel(changePercent, previousValue)}
          </div>
        </div>
      </div>
    </div>
  );
}
