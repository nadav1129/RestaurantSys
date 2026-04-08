import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/api";
import { EmptyState, PageContainer, PageHeader, SectionCard, StatCard } from "../components/ui/layout";
import { PosStatusPill } from "../components/ui/pos";
import { formatMoney } from "../utils/money";

type ShiftDto = {
  shiftId: string;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "planned" | "active" | "closed" | "cancelled" | string;
  createdAt: string;
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

type DashboardQueueDto = {
  queueId: string;
  label: string;
  stationType: string;
  openOrders: number;
  pendingItems: number;
  readyItems: number;
  averageAgeMinutes: number;
};

type ShiftDashboardDto = {
  summary: DashboardSummaryDto;
  revenueTimeline: Array<unknown>;
  tables: Array<unknown>;
  queues: DashboardQueueDto[];
  staff: Array<unknown>;
};

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

export default function OrdersPage() {
  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [dashboard, setDashboard] = useState<ShiftDashboardDto>(emptyDashboard);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    void loadActiveShift();
  }, []);

  useEffect(() => {
    if (!activeShift?.shiftId || activeShift.status !== "active" || activeShift.endedAt) {
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
        console.error("Failed to load orders dashboard", err);
        if (!cancelled) setDashboardError("Failed to load orders dashboard.");
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
  }, [activeShift?.shiftId, activeShift?.status, activeShift?.endedAt]);

  async function loadActiveShift() {
    try {
      setShiftLoading(true);
      setShiftError(null);
      const shift = (await apiFetch("/api/shifts/active")) as ShiftDto | null;
      setActiveShift(shift ?? null);
    } catch (err) {
      console.error("Failed to load active shift", err);
      setShiftError("Failed to load active shift.");
    } finally {
      setShiftLoading(false);
    }
  }

  const hasActiveShift =
    !!activeShift && activeShift.status === "active" && !activeShift.endedAt;

  const orderSignal = useMemo(
    () => [
      {
        label: "Open Orders",
        value: dashboard.summary.openOrdersCount,
        hint: "Orders currently still open in this shift.",
      },
      {
        label: "Pending Items",
        value: dashboard.summary.pendingItemsCount,
        hint: "Items marked pending or in progress.",
        tone: dashboard.summary.pendingItemsCount > 0 ? "warning" as const : "default" as const,
      },
      {
        label: "Ready Items",
        value: dashboard.summary.readyItemsCount,
        hint: "Items already marked ready by checker flow.",
        tone: dashboard.summary.readyItemsCount > 0 ? "success" as const : "default" as const,
      },
    ],
    [dashboard.summary]
  );

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Orders"
        title="Orders"
        description="Dedicated order-pressure monitoring using the same live dashboard data as management."
        actions={
          <div className="flex flex-wrap gap-2">
            <PosStatusPill>{dashboardLoading ? "Refreshing..." : "Live"}</PosStatusPill>
            {hasActiveShift ? <PosStatusPill tone="accent">Shift active</PosStatusPill> : null}
          </div>
        }
      />

      {!hasActiveShift ? (
        <SectionCard
          title="No active shift"
          description="Start a shift from Management to unlock live order monitoring on this page."
        >
          <div className="space-y-4">
            {shiftLoading ? (
              <div className="text-sm text-[var(--muted-foreground)]">Loading active shift...</div>
            ) : (
              <EmptyState
                title="Orders page is ready"
                description="This page is its own destination now, but it still depends on the active shift dashboard feed."
              />
            )}

            {shiftError ? (
              <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                {shiftError}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {orderSignal.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                hint={item.hint}
                tone={item.tone}
              />
            ))}
          </div>

          <SectionCard
            title="Queue Pressure"
            description="The same queue and order-pressure detail previously nested under Management > Dashboard > Orders."
          >
            {dashboard.queues.length === 0 ? (
              <EmptyState
                title="No order pressure"
                description="Queue activity will appear here when there are open orders in the shift."
              />
            ) : (
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
                    {dashboard.queues.map((queue) => {
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
                            <PosStatusPill tone={status.tone}>
                              {status.label}
                            </PosStatusPill>
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
            )}

            {dashboardError ? (
              <div className="mt-4 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                {dashboardError}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Order Notes" description="Helpful shift context for the order view.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rs-surface-muted p-4">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Current pulse
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {dashboard.summary.openOrdersCount} open orders are spread across{" "}
                  {dashboard.summary.openTablesCount} tables.
                </div>
              </div>
              <div className="rs-surface-muted p-4">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Revenue so far
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  Closed order revenue is NIS {formatMoney(dashboard.summary.totalIncomeCents / 100)} with tips at NIS{" "}
                  {formatMoney(dashboard.summary.totalTipsCents / 100)}.
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
}
