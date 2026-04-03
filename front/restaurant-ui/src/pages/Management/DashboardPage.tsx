import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/api";
import Button from "../../components/Button";
import {
  AlertTriangleIcon,
  AnalyticsIcon,
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
import { cn } from "../../lib/utils";

type DashboardTab = "alerts" | "tables" | "orders" | "staff";

type ShiftDto = {
  shiftId: string;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "planned" | "active" | "closed" | "cancelled" | string;
  createdAt: string;
};

type DashboardPageProps = {
  hasActiveShift: boolean;
  onStartShift: () => void;
};

const dashboardTabs: Array<{
  id: DashboardTab;
  label: string;
  icon: typeof AlertTriangleIcon;
  description: string;
}> = [
  {
    id: "alerts",
    label: "Alerts",
    icon: AlertTriangleIcon,
    description: "High-priority issues and service bottlenecks.",
  },
  {
    id: "tables",
    label: "Tables",
    icon: TableIcon,
    description: "Guest seating, turn speed, and coverage.",
  },
  {
    id: "orders",
    label: "Orders",
    icon: OrdersIcon,
    description: "Live throughput for kitchen and bar queues.",
  },
  {
    id: "staff",
    label: "Staff",
    icon: StaffIcon,
    description: "Who is on shift and where pressure is building.",
  },
];

export default function DashboardPage({
  hasActiveShift: _hasActiveShiftFromParent,
  onStartShift,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("alerts");
  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedText, setElapsedText] = useState("00:00");

  useEffect(() => {
    void loadActiveShift();
  }, []);

  async function loadActiveShift() {
    try {
      setLoading(true);
      setError(null);
      const shift = (await apiFetch("/api/shifts/active")) as ShiftDto | null;
      setActiveShift(shift ?? null);
    } catch (err) {
      console.error("Failed to load active shift", err);
      setError("Failed to load active shift.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeShift || !activeShift.startedAt || activeShift.status !== "active") {
      setElapsedText("00:00");
      return;
    }

    const startMs = new Date(activeShift.startedAt).getTime();

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, now - startMs);
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const h = hours.toString().padStart(2, "0");
      const m = minutes.toString().padStart(2, "0");
      const s = seconds.toString().padStart(2, "0");

      setElapsedText(hours > 0 ? `${h}:${m}:${s}` : `${m}:${s}`);
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [activeShift?.shiftId, activeShift?.startedAt, activeShift?.status]);

  async function handleStartShift() {
    try {
      setLoading(true);
      setError(null);

      const created = (await apiFetch("/api/shifts", {
        method: "POST",
        body: { name: null },
      })) as ShiftDto;

      setActiveShift(created);
      onStartShift();
    } catch (err) {
      console.error("Failed to start shift", err);
      setError("Failed to start shift.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndShift() {
    if (!activeShift) return;

    try {
      setLoading(true);
      setError(null);

      await apiFetch(`/api/shifts/${activeShift.shiftId}/close`, {
        method: "POST",
      });

      setActiveShift(null);
    } catch (err) {
      console.error("Failed to end shift", err);
      setError("Failed to end shift.");
    } finally {
      setLoading(false);
    }
  }

  const hasActiveShift =
    !!activeShift && activeShift.status === "active" && !activeShift.endedAt;

  const activeTabMeta = useMemo(
    () => dashboardTabs.find((tab) => tab.id === activeTab) ?? dashboardTabs[0],
    [activeTab]
  );

  if (!hasActiveShift) {
    return (
      <SectionCard
        title="No active shift"
        description="Start a shift to unlock live oversight for alerts, table flow, orders, and staffing."
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[var(--card-muted)] p-6">
              <div className="font-display text-2xl font-semibold text-[var(--foreground)]">
                Dashboard is ready
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                The new management dashboard is set up with calmer SaaS-style hierarchy. Starting a shift keeps all existing logic intact while enabling the live overview surface.
              </p>
              {error ? (
                <div className="mt-4 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                  {error}
                </div>
              ) : null}
              <div className="mt-6">
                <Button onClick={handleStartShift} disabled={loading}>
                  {loading ? "Starting..." : "Start Shift"}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <StatCard
              label="Shift Status"
              value="Standby"
              hint="Start a shift to populate live operational metrics."
            />
            <StatCard
              label="Analytics"
              value="Ready"
              hint="KPI, charts, and tabbed monitoring are already laid out."
              tone="success"
            />
            <StatCard
              label="Data Safety"
              value="Frontend only"
              hint="No backend, API contract, or database behavior was changed."
            />
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Current Shift Overview"
        description="A clearer live-management surface for the current shift."
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="rs-pill">
                <ClockIcon className="h-4 w-4" />
                Shift started at{" "}
                {activeShift?.startedAt
                  ? new Date(activeShift.startedAt).toLocaleTimeString()
                  : "—"}
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {elapsedText}
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Time on shift. Use the action strip below to move between alerts, tables, orders, and staff.
              </div>
              {activeShift?.name ? (
                <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Shift name: {activeShift.name}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rs-pill">Today</div>
              <div className="rs-pill">Current shift</div>
              <Button variant="danger" onClick={handleEndShift} disabled={loading}>
                {loading ? "Ending..." : "End Shift"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Guests" value="—" hint="Currently in house" />
            <StatCard label="Total Income" value="—" hint="Since shift start" />
            <StatCard label="Total Tips" value="—" hint="Across all open orders" />
            <StatCard label="Open Tables" value="—" hint="Active and seated" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Analytics preview
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Reserved chart area for revenue pace, covers by hour, and live service pressure.
                  </div>
                </div>
                <div className="rs-pill">
                  <AnalyticsIcon className="h-4 w-4" />
                  Placeholder ready
                </div>
              </div>

              <div className="mt-6 grid h-[220px] grid-cols-6 items-end gap-3">
                {[36, 48, 41, 70, 82, 64].map((height, index) => (
                  <div key={height + index} className="flex flex-col items-center gap-3">
                    <div
                      className="w-full rounded-t-[22px] bg-gradient-to-t from-[var(--primary)] to-[var(--accent)]"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs font-medium text-[var(--muted-foreground)]">
                      {16 + index}:00
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rs-surface-muted p-4">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Live signals
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  This sidebar is meant for at-a-glance health signals once the related data is connected.
                </div>
              </div>
              <div className="rs-surface-muted p-4">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Safe placeholder strategy
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  The layout has been upgraded without introducing new backend dependencies or changing existing APIs.
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
              {error}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="rs-action-strip">
        {dashboardTabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex min-w-[180px] flex-1 items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-muted)]"
              )}
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-current">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold">{tab.label}</div>
                <div
                  className={cn(
                    "mt-1 text-xs leading-5",
                    active ? "text-[var(--accent-foreground)]/80" : "text-[var(--muted-foreground)]"
                  )}
                >
                  {tab.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard
          title={activeTabMeta.label}
          description={activeTabMeta.description}
        >
          {activeTab === "alerts" && <AlertsTab />}
          {activeTab === "tables" && <TablesTab />}
          {activeTab === "orders" && <OrdersTab />}
          {activeTab === "staff" && <StaffTab />}
        </SectionCard>

        <SectionCard
          title="Management Notes"
          description="Reserved space for the operational context that supports the active view."
        >
          <div className="space-y-3">
            <div className="rs-surface-muted p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Active lens
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {activeTabMeta.label} is front and center right now, with the action strip attached directly under the overview panel for faster switching.
              </div>
            </div>
            <div className="rs-surface-muted p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Next integrations
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Wire guest counts, order queue states, and staff clock-ins when those data sources are ready. The visual structure is already prepared.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function AlertsTab() {
  return (
    <div className="space-y-3">
      <div className="rs-surface-muted p-4">
        <div className="text-sm font-semibold text-[var(--foreground)]">
          Service timing alerts
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Tables without service, overdue course pacing, or stalled orders will surface here once connected.
        </div>
      </div>
      <div className="rs-surface-muted p-4">
        <div className="text-sm font-semibold text-[var(--foreground)]">
          Inventory warnings
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Critical stock notifications and operational blockers can be shown without changing the backend contract now.
        </div>
      </div>
    </div>
  );
}

function TablesTab() {
  return (
    <div className="space-y-3">
      <EmptyState
        title="Tables overview is ready"
        description="This section is prepared for active tables, guests, server ownership, and table-turn metrics once those feeds are connected."
      />
    </div>
  );
}

function OrdersTab() {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[26px] border border-[var(--border)] bg-[var(--card-muted)]">
        <table className="rs-table">
          <thead>
            <tr>
              <th>Queue</th>
              <th>Status</th>
              <th>Focus</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-[var(--foreground)]">Kitchen</td>
              <td>Placeholder</td>
              <td className="text-[var(--muted-foreground)]">
                Pending tickets, prep pace, and aging items.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-[var(--foreground)]">Bar</td>
              <td>Placeholder</td>
              <td className="text-[var(--muted-foreground)]">
                Cocktail queue, ready items, and service lag.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffTab() {
  return (
    <div className="grid gap-3">
      <div className="rs-surface-muted p-4">
        <div className="text-sm font-semibold text-[var(--foreground)]">
          On-shift roster
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Staff load, role coverage, and tip summaries will fit naturally into this calmer layout.
        </div>
      </div>
      <div className="rs-surface-muted p-4">
        <div className="text-sm font-semibold text-[var(--foreground)]">
          Station pressure
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Connect live shift and station data here to show where reinforcements are needed.
        </div>
      </div>
    </div>
  );
}
