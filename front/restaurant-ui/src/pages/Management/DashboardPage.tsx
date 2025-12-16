import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/api";

type DashboardTab = "alerts" | "tables" | "orders" | "staff";

type ShiftDto = {
  shiftId: string;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "planned" | "active" | "closed" | "cancelled" | string;
  createdAt: string;
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("alerts");

  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elapsedText, setElapsedText] = useState<string>("00:00");

  // Load current active shift on mount
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

  // Compute elapsed time from startedAt
  useEffect(() => {
    if (!activeShift || !activeShift.startedAt || activeShift.status !== "active") {
      setElapsedText("00:00");
      return;
    }

    const startMs = new Date(activeShift.startedAt).getTime();

    const update = () => {
      const now = Date.now();
      let diff = now - startMs;
      if (diff < 0) diff = 0;

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const h = hours.toString().padStart(2, "0");
      const m = minutes.toString().padStart(2, "0");
      const s = seconds.toString().padStart(2, "0");

      setElapsedText(hours > 0 ? `${h}:${m}:${s}` : `${m}:${s}`);
    };

    update(); // set initial
    const id = window.setInterval(update, 1000);

    return () => window.clearInterval(id);
  }, [activeShift?.shiftId, activeShift?.startedAt, activeShift?.status]);

  async function handleStartShift() {
    try {
      setLoading(true);
      setError(null);

      const created = (await apiFetch("/api/shifts", {
        method: "POST",
        body: { name: null }, // optional shift name, you can change later
      })) as ShiftDto;

      setActiveShift(created);
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

      // After closing we treat it as "no active shift"
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

  /* If no active shift, show guard screen */
  if (!hasActiveShift) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Dashboard
          </div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            No active shift
          </div>
          <p className="mt-2 text-sm text-gray-600">
            To view live data about guests, income, tips and staff, you need to
            start a shift.
          </p>

          {error && (
            <div className="mt-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleStartShift}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
          >
            {loading ? "Starting…" : "Start Shift"}
          </button>
        </div>
      </div>
    );
  }

  /* When there is an active shift, show full dashboard layout */
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4">
      {/* Top: Analytics header + shift info */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Dashboard
            </div>
            <div className="text-lg font-semibold text-gray-900">
              Current Shift Overview
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Shift started at{" "}
              {activeShift?.startedAt
                ? new Date(activeShift.startedAt).toLocaleTimeString()
                : "—"}
              {" • "}
              Time on shift: <span className="font-semibold">{elapsedText}</span>
            </div>
            {activeShift?.name && (
              <div className="mt-0.5 text-xs text-gray-500">
                Name: {activeShift.name}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 text-xs text-gray-500">
            {/* Filters placeholder */}
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-gray-200 px-2 py-1">
                Today
              </span>
              <span className="rounded-full border border-gray-200 px-2 py-1">
                Current Shift
              </span>
            </div>

            <button
              type="button"
              onClick={handleEndShift}
              disabled={loading}
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {loading ? "Ending…" : "End Shift"}
            </button>

            {error && (
              <div className="mt-1 text-[11px] text-red-600">{error}</div>
            )}
          </div>
        </div>

        {/* Summary tiles: guests, income, tips, etc. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Guests" value="—" hint="Currently in house" />
          <SummaryTile
            label="Total Income"
            value="—"
            hint="Since shift start"
          />
          <SummaryTile label="Total Tips" value="—" hint="All sources" />
          <SummaryTile
            label="Open Tables"
            value="—"
            hint="Active & seated"
          />
        </div>

        {/* Reserved area for analytics graphs */}
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          Analytics graphs area (reserved).
          <br />
          Later we will add charts here for:
          <ul className="mt-1 list-disc pl-5">
            <li>Income over time vs. typical day</li>
            <li>Guests per hour</li>
            <li>Tips vs. revenue</li>
          </ul>
        </div>
      </section>

      {/* Middle: tab content (alerts / tables / orders / staff) */}
      <section className="flex-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {activeTab === "alerts" && <AlertsTab />}
        {activeTab === "tables" && <TablesTab />}
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "staff" && <StaffTab />}
      </section>

      {/* Bottom: bar with subpage tabs */}
      <nav className="sticky bottom-0 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          <DashboardTabButton
            label="Alerts"
            active={activeTab === "alerts"}
            onClick={() => setActiveTab("alerts")}
          />
          <DashboardTabButton
            label="Tables"
            active={activeTab === "tables"}
            onClick={() => setActiveTab("tables")}
          />
          <DashboardTabButton
            label="Orders"
            active={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
          />
          <DashboardTabButton
            label="Staff"
            active={activeTab === "staff"}
            onClick={() => setActiveTab("staff")}
          />
        </div>
      </nav>
    </div>
  );
}

/* Small reusable components */

function SummaryTile(props: { label: string; value: string; hint?: string }) {
  const { label, value, hint } = props;
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

function DashboardTabButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { label, active, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full rounded-xl px-3 py-2 text-center text-xs font-medium transition " +
        (active
          ? "bg-gray-900 text-white shadow-sm"
          : "bg-gray-50 text-gray-700 hover:bg-gray-100")
      }
    >
      {label}
    </button>
  );
}

/* Placeholder tab contents – unchanged */

function AlertsTab() {
  return (
    <div className="h-full">
      <div className="text-sm font-semibold text-gray-900">Alerts</div>
      <p className="mt-1 text-sm text-gray-600">
        This panel will show real-time issues and notifications:
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
        <li>Tables without service for a long time</li>
        <li>Orders waiting in kitchen for too long</li>
        <li>Low stock warnings for important products</li>
      </ul>
    </div>
  );
}

function TablesTab() {
  return (
    <div className="h-full">
      <div className="text-sm font-semibold text-gray-900">Tables</div>
      <p className="mt-1 text-sm text-gray-600">
        Overview of active tables, guests and minimum spend.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Later we will connect this to the tables system and show:
        <br />
        table number, guests, server, status, time seated, and running total.
      </p>
    </div>
  );
}

function OrdersTab() {
  return (
    <div className="h-full">
      <div className="text-sm font-semibold text-gray-900">Orders</div>
      <p className="mt-1 text-sm text-gray-600">
        Live queue of orders for bar and kitchen, with statuses.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Later we will pull data from the orders system and show:
        <br />
        pending orders, in-progress, ready, and average prep times.
      </p>
    </div>
  );
}

function StaffTab() {
  return (
    <div className="h-full">
      <div className="text-sm font-semibold text-gray-900">Staff</div>
      <p className="mt-1 text-sm text-gray-600">
        Staff on shift, their roles and current load.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Later we will connect to the shift system to show:
        <br />
        who is clocked in, which station they handle, and live tip summary.
      </p>
    </div>
  );
}
