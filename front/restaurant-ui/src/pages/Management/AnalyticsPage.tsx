import {
  AlertTriangleIcon,
  AnalyticsIcon,
  CheckCircleIcon,
  ClockIcon,
  OrdersIcon,
  StaffIcon,
  TableIcon,
} from "../../components/icons";
import {
  EmptyState,
  SectionCard,
  StatCard,
} from "../../components/ui/layout";

const hourlyLoad = [
  { time: "16:00", covers: 18, pace: "Calm" },
  { time: "17:00", covers: 26, pace: "Steady" },
  { time: "18:00", covers: 41, pace: "Busy" },
  { time: "19:00", covers: 54, pace: "Peak" },
  { time: "20:00", covers: 47, pace: "Busy" },
];

const insightCards = [
  {
    title: "Revenue Trend",
    value: "Placeholder",
    hint: "Ready for real revenue and avg check data once analytics wiring is available.",
    icon: AnalyticsIcon,
  },
  {
    title: "Table Turns",
    value: "Placeholder",
    hint: "Best fit for live covers, seatings, and turnover by station.",
    icon: TableIcon,
  },
  {
    title: "Order Throughput",
    value: "Placeholder",
    hint: "Can later connect to kitchen/bar queue timing and completion rates.",
    icon: OrdersIcon,
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value="—"
          hint="Placeholder for shift or daily sales."
        />
        <StatCard
          label="Average Check"
          value="—"
          hint="Placeholder for guest spend trends."
        />
        <StatCard
          label="Open Orders"
          value="—"
          hint="Placeholder for live order volume."
        />
        <StatCard
          label="Labor Coverage"
          value="—"
          hint="Placeholder for staffing vs. service load."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard
          title="Operations Snapshot"
          description="Adapted as a placeholder-ready analytics workspace so real data can drop in later without another layout rewrite."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {insightCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rs-surface-muted flex h-full flex-col justify-between p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {card.title}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <div className="mt-8 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                    {card.value}
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                    {card.hint}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Service Load Curve
                </div>
                <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Placeholder chart area inspired by the shadcn dashboard block pattern.
                </div>
              </div>
              <div className="rs-pill">
                <ClockIcon className="h-4 w-4" />
                Last 6 hours
              </div>
            </div>

            <div className="mt-6 grid h-[240px] grid-cols-5 items-end gap-3">
              {[36, 52, 78, 100, 82].map((height, index) => (
                <div key={height + index} className="flex flex-col items-center gap-3">
                  <div
                    className="w-full rounded-t-[22px] bg-gradient-to-t from-[var(--primary)] to-[var(--accent)]"
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-xs font-medium text-[var(--muted-foreground)]">
                    {hourlyLoad[index]?.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Shift Signals"
          description="Clean placeholders that can connect to real backend metrics later."
        >
          <div className="space-y-3">
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--success-surface)] text-[var(--success)]">
                <CheckCircleIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Analytics page is scaffolded
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  The layout is ready for KPI cards, charts, team activity, and service bottleneck panels.
                </div>
              </div>
            </div>
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--warning-surface)] text-[var(--warning)]">
                <AlertTriangleIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Data wiring intentionally deferred
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  No backend or API shape changes were introduced just to support analytics visuals.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              Upcoming sections
            </div>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <OrdersIcon className="mt-0.5 h-4.5 w-4.5 text-[var(--muted-foreground)]" />
                <div>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    Throughput health
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Prep-time distribution, queue aging, and completion rates.
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <TableIcon className="mt-0.5 h-4.5 w-4.5 text-[var(--muted-foreground)]" />
                <div>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    Seating pulse
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Covers by hour, table-turn velocity, and wait pressure.
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <StaffIcon className="mt-0.5 h-4.5 w-4.5 text-[var(--muted-foreground)]" />
                <div>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    Team coverage
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Staffing depth, shift mix, and live capacity.
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Hourly Planning Table"
        description="A placeholder-ready management table that matches the calmer SaaS table styling used elsewhere."
      >
        <div className="overflow-x-auto rounded-[26px] border border-[var(--border)] bg-[var(--card-muted)]">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Covers</th>
                <th>Service Pace</th>
                <th>Recommended Focus</th>
              </tr>
            </thead>
            <tbody>
              {hourlyLoad.map((row) => (
                <tr key={row.time}>
                  <td className="font-medium text-[var(--foreground)]">{row.time}</td>
                  <td>{row.covers}</td>
                  <td>{row.pace}</td>
                  <td className="text-[var(--muted-foreground)]">
                    Placeholder guidance for staffing and queue handling.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <EmptyState
        title="Analytics is ready for real data"
        description="The page is intentionally built with placeholders and stable sections so future metrics can be connected without redesigning the management experience again."
      />
    </div>
  );
}
