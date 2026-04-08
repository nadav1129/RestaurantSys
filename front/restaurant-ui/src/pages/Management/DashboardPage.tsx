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
import { formatMoney } from "../../utils/money";

type DashboardTab = "alerts" | "tables" | "orders" | "staff";

type ShiftDto = {
  shiftId: string;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "planned" | "active" | "closed" | "cancelled" | string;
  createdAt: string;
};

type CancelRequestDto = {
  orderItemId: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  sourceLabel: string;
  requestedAt: string;
};

type DashboardSummaryDto = {
  currentGuestCount: number;
  openTablesCount: number;
  openOrdersCount: number;
  totalIncomeCents: number;
  totalTipsCents: number;
  cancelRequestsCount: number;
  activeStaffCount: number;
  pendingItemsCount: number;
  readyItemsCount: number;
};

type DashboardTrendPointDto = {
  label: string;
  ordersCount: number;
  revenueCents: number;
};

type DashboardTableDto = {
  orderId: string;
  tableId: string;
  tableNumber: number;
  guestLabel: string;
  dinersCount: number | null;
  openedAt: string;
  minutesOpen: number;
  currentTotalCents: number;
  paymentStatus: string;
  source: string;
};

type DashboardQueueDto = {
  queueId: string;
  label: string;
  stationType: string;
  openOrders: number;
  pendingItems: number;
  readyItems: number;
  averageAgeMinutes: number;
};

type DashboardStaffDto = {
  shiftWorkerId: string;
  workerId: string;
  name: string;
  position: string;
  stationName: string | null;
  deviceType: string;
  startedAt: string;
  minutesOnShift: number;
};

type ShiftDashboardDto = {
  summary: DashboardSummaryDto;
  revenueTimeline: DashboardTrendPointDto[];
  tables: DashboardTableDto[];
  queues: DashboardQueueDto[];
  staff: DashboardStaffDto[];
};

type DashboardPageProps = {
  hasActiveShift?: boolean;
  onStartShift: () => void;
  onShiftStateChange?: (hasActiveShift: boolean) => void;
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
    description: "Guest seating, turn speed, and active checks.",
  },
  {
    id: "orders",
    label: "Orders",
    icon: OrdersIcon,
    description: "Open order flow, pending items, and queue pressure.",
  },
  {
    id: "staff",
    label: "Staff",
    icon: StaffIcon,
    description: "Who is clocked in and how coverage is distributed.",
  },
];

const emptyDashboard: ShiftDashboardDto = {
  summary: {
    currentGuestCount: 0,
    openTablesCount: 0,
    openOrdersCount: 0,
    totalIncomeCents: 0,
    totalTipsCents: 0,
    cancelRequestsCount: 0,
    activeStaffCount: 0,
    pendingItemsCount: 0,
    readyItemsCount: 0,
  },
  revenueTimeline: [],
  tables: [],
  queues: [],
  staff: [],
};

function formatCurrency(cents: number) {
  return `NIS ${formatMoney(cents / 100)}`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function getQueueStatus(queue: DashboardQueueDto) {
  if (queue.pendingItems >= 8 || queue.averageAgeMinutes >= 30) {
    return { label: "Needs attention", tone: "warning" as const };
  }

  if (queue.pendingItems > 0) {
    return { label: "In progress", tone: "default" as const };
  }

  if (queue.readyItems > 0) {
    return { label: "Ready", tone: "success" as const };
  }

  return { label: "Quiet", tone: "default" as const };
}

function getSignalCards(summary: DashboardSummaryDto, queues: DashboardQueueDto[]) {
  const hottestQueue = [...queues].sort((a, b) => {
    const left = b.pendingItems - a.pendingItems;
    if (left !== 0) return left;
    return b.averageAgeMinutes - a.averageAgeMinutes;
  })[0];

  return [
    {
      label: "Pending items",
      value: String(summary.pendingItemsCount),
      hint:
        summary.readyItemsCount > 0
          ? `${summary.readyItemsCount} items already marked ready.`
          : "Nothing is staged as ready yet.",
    },
    {
      label: "Cancel requests",
      value: String(summary.cancelRequestsCount),
      hint:
        summary.cancelRequestsCount > 0
          ? "Alerts tab has requests waiting for a decision."
          : "No cancellation decisions are waiting.",
    },
    {
      label: hottestQueue ? hottestQueue.label : "Queue pressure",
      value: hottestQueue ? `${hottestQueue.pendingItems} pending` : "Stable",
      hint: hottestQueue
        ? `${hottestQueue.openOrders} open orders, average age ${formatMinutes(
            hottestQueue.averageAgeMinutes
          )}.`
        : "No active queue pressure right now.",
    },
  ];
}

export default function DashboardPage({
  hasActiveShift: _hasActiveShiftFromParent,
  onStartShift,
  onShiftStateChange,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("alerts");
  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [dashboard, setDashboard] = useState<ShiftDashboardDto>(emptyDashboard);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [elapsedText, setElapsedText] = useState("00:00");

  useEffect(() => {
    void loadActiveShift();
  }, []);

  useEffect(() => {
    if (!activeShift || !activeShift.shiftId || activeShift.status !== "active") {
      setDashboard(emptyDashboard);
      setDashboardError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setDashboardLoading(true);
        setDashboardError(null);
        const data = (await apiFetch(
          `/api/shifts/${activeShift.shiftId}/dashboard`
        )) as ShiftDashboardDto | null;

        if (!cancelled) {
          setDashboard(data ?? emptyDashboard);
        }
      } catch (err) {
        console.error("Failed to load dashboard", err);
        if (!cancelled) setDashboardError("Failed to load shift dashboard.");
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeShift?.shiftId, activeShift?.status]);

  async function loadActiveShift() {
    try {
      setShiftLoading(true);
      setShiftError(null);
      const shift = (await apiFetch("/api/shifts/active")) as ShiftDto | null;
      const nextShift = shift ?? null;
      const hasActive = !!nextShift && nextShift.status === "active" && !nextShift.endedAt;

      setActiveShift(nextShift);
      onShiftStateChange?.(hasActive);
    } catch (err) {
      console.error("Failed to load active shift", err);
      setShiftError("Failed to load active shift.");
      onShiftStateChange?.(false);
    } finally {
      setShiftLoading(false);
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
      setShiftLoading(true);
      setShiftError(null);

      const created = (await apiFetch("/api/shifts", {
        method: "POST",
        body: { name: null },
      })) as ShiftDto;

      setActiveShift(created);
      setDashboard(emptyDashboard);
      onStartShift();
      onShiftStateChange?.(true);
    } catch (err) {
      console.error("Failed to start shift", err);
      setShiftError("Failed to start shift.");
    } finally {
      setShiftLoading(false);
    }
  }

  async function handleEndShift() {
    if (!activeShift) return;

    try {
      setShiftLoading(true);
      setShiftError(null);

      await apiFetch(`/api/shifts/${activeShift.shiftId}/close`, {
        method: "POST",
      });

      setActiveShift(null);
      setDashboard(emptyDashboard);
      onShiftStateChange?.(false);
    } catch (err) {
      console.error("Failed to end shift", err);
      setShiftError("Failed to end shift.");
    } finally {
      setShiftLoading(false);
    }
  }

  const hasActiveShift =
    !!activeShift && activeShift.status === "active" && !activeShift.endedAt;

  const activeTabMeta = useMemo(
    () => dashboardTabs.find((tab) => tab.id === activeTab) ?? dashboardTabs[0],
    [activeTab]
  );

  const signalCards = useMemo(
    () => getSignalCards(dashboard.summary, dashboard.queues),
    [dashboard.queues, dashboard.summary]
  );

  const chartBars = useMemo(() => {
    const maxRevenue = Math.max(
      1,
      ...dashboard.revenueTimeline.map((point) => point.revenueCents)
    );
    const maxOrders = Math.max(
      1,
      ...dashboard.revenueTimeline.map((point) => point.ordersCount)
    );

    return dashboard.revenueTimeline.map((point) => {
      const ratio =
        point.revenueCents > 0
          ? point.revenueCents / maxRevenue
          : point.ordersCount / maxOrders;

      return {
        ...point,
        height: Math.max(14, Math.round(ratio * 100)),
      };
    });
  }, [dashboard.revenueTimeline]);

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
                This view now reads from the live management API. Starting a shift will populate the overview, tables, queue, and staffing tabs automatically.
              </p>
              {shiftError ? (
                <div className="mt-4 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                  {shiftError}
                </div>
              ) : null}
              <div className="mt-6">
                <Button onClick={handleStartShift} disabled={shiftLoading}>
                  {shiftLoading ? "Starting..." : "Start Shift"}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <StatCard
              label="Shift Status"
              value="Standby"
              hint="Waiting for the next active shift."
            />
            <StatCard
              label="Dashboard API"
              value="Connected"
              hint="Overview data now comes from live shift, order, staff, and settings endpoints."
              tone="success"
            />
            <StatCard
              label="Refresh"
              value="15 sec"
              hint="The management view refreshes automatically while a shift is active."
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
        description="A live management surface for the current shift."
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="rs-pill">
                <ClockIcon className="h-4 w-4" />
                Shift started at{" "}
                {activeShift?.startedAt
                  ? new Date(activeShift.startedAt).toLocaleTimeString()
                  : "--"}
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
              <div className="rs-pill">
                {dashboardLoading ? "Refreshing..." : "Live"}
              </div>
              <Button variant="danger" onClick={handleEndShift} disabled={shiftLoading}>
                {shiftLoading ? "Ending..." : "End Shift"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Guests"
              value={dashboard.summary.currentGuestCount}
              hint="Current in-house guest count from management settings."
            />
            <StatCard
              label="Total Income"
              value={formatCurrency(dashboard.summary.totalIncomeCents)}
              hint="Closed order totals captured since shift start."
            />
            <StatCard
              label="Total Tips"
              value={formatCurrency(dashboard.summary.totalTipsCents)}
              hint="Tip totals recorded on completed payments."
            />
            <StatCard
              label="Open Tables"
              value={dashboard.summary.openTablesCount}
              hint={`${dashboard.summary.openOrdersCount} open orders are currently active.`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Revenue pace
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Last 6 hourly buckets for orders opened in this shift.
                  </div>
                </div>
                <div className="rs-pill">
                  <AnalyticsIcon className="h-4 w-4" />
                  {dashboard.revenueTimeline.length} buckets
                </div>
              </div>

              {chartBars.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
                  Revenue history will appear here once the shift dashboard has data.
                </div>
              ) : (
                <div className="mt-6 grid h-[220px] grid-cols-6 items-end gap-3">
                  {chartBars.map((point) => (
                    <div key={point.label} className="flex flex-col items-center gap-3">
                      <div className="w-full space-y-2">
                        <div
                          className="w-full rounded-t-[22px] bg-gradient-to-t from-[var(--primary)] to-[var(--accent)]"
                          style={{ height: `${point.height}%` }}
                        />
                        <div className="text-center text-[11px] text-[var(--muted-foreground)]">
                          {formatCurrency(point.revenueCents)}
                        </div>
                      </div>
                      <div className="text-xs font-medium text-[var(--muted-foreground)]">
                        {point.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {signalCards.map((signal) => (
                <div key={signal.label} className="rs-surface-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {signal.label}
                    </div>
                    <div className="text-lg font-semibold text-[var(--foreground)]">
                      {signal.value}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    {signal.hint}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {shiftError ? (
            <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
              {shiftError}
            </div>
          ) : null}

          {dashboardError ? (
            <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
              {dashboardError}
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
          {activeTab === "alerts" && (
            <AlertsTab shiftId={activeShift?.shiftId ?? null} />
          )}
          {activeTab === "tables" && <TablesTab tables={dashboard.tables} />}
          {activeTab === "orders" && (
            <OrdersTab
              queues={dashboard.queues}
              summary={dashboard.summary}
            />
          )}
          {activeTab === "staff" && <StaffTab staff={dashboard.staff} />}
        </SectionCard>

        <SectionCard
          title="Management Notes"
          description="Live operational context for the active shift."
        >
          <div className="space-y-3">
            <div className="rs-surface-muted p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Shift pulse
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {dashboard.summary.openOrdersCount} open orders are spread across{" "}
                {dashboard.summary.openTablesCount} tables, with{" "}
                {dashboard.summary.activeStaffCount} staff currently clocked in.
              </div>
            </div>
            <div className="rs-surface-muted p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Current focus
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                There are {dashboard.summary.pendingItemsCount} pending items and{" "}
                {dashboard.summary.cancelRequestsCount} cancellation requests waiting for action.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function AlertsTab({ shiftId }: { shiftId: string | null }) {
  const [requests, setRequests] = useState<CancelRequestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftId) {
      setRequests([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = (await apiFetch(
          `/api/shifts/${shiftId}/cancel-requests`
        )) as CancelRequestDto[] | null;

        if (!cancelled) {
          setRequests(data ?? []);
        }
      } catch (err) {
        console.error("Failed to load cancel requests", err);
        if (!cancelled) setError("Failed to load cancel requests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [shiftId]);

  async function decide(orderItemId: string, approved: boolean) {
    try {
      setWorkingId(orderItemId);
      await apiFetch(`/api/orders/items/${orderItemId}/cancel-request`, {
        method: "PATCH",
        body: { approved },
      });
      setRequests((prev) => prev.filter((row) => row.orderItemId !== orderItemId));
    } catch (err) {
      console.error("Failed to decide cancel request", err);
      setError("Failed to update request.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rs-surface-muted p-4 text-sm text-[var(--muted-foreground)]">
          Loading...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}

      {requests.length === 0 && !loading ? (
        <EmptyState
          title="No alerts"
          description="No cancel requests are waiting for a decision."
        />
      ) : null}

      {requests.map((request) => (
        <div key={request.orderItemId} className="rs-surface-muted p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">
                {request.quantity}x {request.productName}
              </div>
              <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                {request.sourceLabel}
              </div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                {new Date(request.requestedAt).toLocaleTimeString()}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void decide(request.orderItemId, false)}
                disabled={workingId === request.orderItemId}
              >
                Reject
              </Button>
              <Button
                onClick={() => void decide(request.orderItemId, true)}
                disabled={workingId === request.orderItemId}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TablesTab({ tables }: { tables: DashboardTableDto[] }) {
  if (tables.length === 0) {
    return (
      <EmptyState
        title="No active tables"
        description="Open table checks will appear here as soon as orders are attached to tables."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-[26px] border border-[var(--border)] bg-[var(--card-muted)]">
      <table className="rs-table">
        <thead>
          <tr>
            <th>Table</th>
            <th>Guest</th>
            <th>Covers</th>
            <th>Open</th>
            <th>Running total</th>
          </tr>
        </thead>
        <tbody>
          {tables.map((table) => (
            <tr key={table.orderId}>
              <td className="font-medium text-[var(--foreground)]">
                Table {table.tableNumber}
              </td>
              <td>{table.guestLabel}</td>
              <td>{table.dinersCount ?? "--"}</td>
              <td>{formatMinutes(table.minutesOpen)}</td>
              <td className="text-[var(--foreground)]">
                {formatCurrency(table.currentTotalCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTab({
  queues,
  summary,
}: {
  queues: DashboardQueueDto[];
  summary: DashboardSummaryDto;
}) {
  if (queues.length === 0) {
    return (
      <EmptyState
        title="No order pressure"
        description="Queue activity will appear here when there are open orders in the shift."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Open Orders"
          value={summary.openOrdersCount}
          hint="Orders currently still open in this shift."
        />
        <StatCard
          label="Pending Items"
          value={summary.pendingItemsCount}
          hint="Items marked pending or in progress."
          tone={summary.pendingItemsCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Ready Items"
          value={summary.readyItemsCount}
          hint="Items already marked ready by checker flow."
          tone={summary.readyItemsCount > 0 ? "success" : "default"}
        />
      </div>

      <div className="overflow-x-auto rounded-[26px] border border-[var(--border)] bg-[var(--card-muted)]">
        <table className="rs-table">
          <thead>
            <tr>
              <th>Queue</th>
              <th>Status</th>
              <th>Open orders</th>
              <th>Pending</th>
              <th>Ready</th>
              <th>Avg age</th>
            </tr>
          </thead>
          <tbody>
            {queues.map((queue) => {
              const status = getQueueStatus(queue);
              return (
                <tr key={queue.queueId}>
                  <td>
                    <div className="font-medium text-[var(--foreground)]">{queue.label}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {queue.stationType}
                    </div>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        status.tone === "warning" &&
                          "bg-[var(--warning-surface)] text-[var(--warning)]",
                        status.tone === "success" &&
                          "bg-[var(--success-surface)] text-[var(--success)]",
                        status.tone === "default" &&
                          "bg-[var(--card)] text-[var(--foreground)]"
                      )}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td>{queue.openOrders}</td>
                  <td>{queue.pendingItems}</td>
                  <td>{queue.readyItems}</td>
                  <td>{formatMinutes(queue.averageAgeMinutes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffTab({ staff }: { staff: DashboardStaffDto[] }) {
  if (staff.length === 0) {
    return (
      <EmptyState
        title="No staff clocked in"
        description="Clocked-in workers will appear here once the team starts the shift."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {staff.map((member) => (
        <div key={member.shiftWorkerId} className="rs-surface-muted p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">
                {member.name}
              </div>
              <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                {member.position}
                {member.stationName ? ` · ${member.stationName}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-[var(--foreground)]">
                {formatMinutes(member.minutesOnShift)}
              </div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                {member.deviceType === "personal" ? "Personal device" : "Fixed device"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
