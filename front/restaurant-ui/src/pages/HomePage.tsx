import React, { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import { apiFetch } from "../api/api";

type DeviceMode = "fixed" | "personal";

type Station = {
  id: string;
  name: string;
  type: string;
};

type AppUser = {
  userId: string;
  workerId: string;
  name: string;
  role?: string;
};

type Worker = {
  id: string;        // userId
  workerId: string;  // FK to workers table
  name: string;
  role?: string;
};

type ShiftDto = {
  shiftId: string;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "planned" | "active" | "closed" | "cancelled" | string;
  createdAt: string;
};

type Props = {
  title?: string; // optional title, defaults to "Home"
  onStart?: () => void; // optional callbacks (we still call these)
  onEnd?: () => void;
  stations?: Station[]; // optional real data, otherwise we use demo
  workers?: Worker[];
  briefText?: string;
};

const DEMO_STATIONS: Station[] = [
  { id: "bar-1", name: "Bar 1", type: "Bar" },
  { id: "floor-1", name: "Floor 1", type: "Floor" },
  { id: "kitchen-1", name: "Kitchen Pass", type: "Kitchen" },
];

const DEMO_WORKERS: Worker[] = [
  { id: "demo-u1", workerId: "demo-w1", name: "LIST", role: "Bartender" },
  { id: "demo-u2", workerId: "demo-w2", name: "DIDNT", role: "Floor" },
  { id: "demo-u3", workerId: "demo-w3", name: "LOAD", role: "Kitchen" },
];

export default function HomePage({
  title = "Home",
  onStart,
  onEnd,
  stations,
  workers,
  briefText,
}: Props) {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("fixed");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    DEMO_STATIONS[0]?.id ?? null
  );

  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  const [shiftPanelMode, setShiftPanelMode] = useState<null | "start" | "end">(
    null
  );
  const [searchWorker, setSearchWorker] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");

  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load app_users + active shift on mount
  useEffect(() => {
    void loadInitial();
  }, []);

  async function loadInitial() {
    try {
      setLoading(true);
      setError(null);

      const [usersResp, shiftResp] = await Promise.all([
        apiFetch("/api/auth/users"),       // list of app_users
        apiFetch("/api/shifts/active"),    // current active shift
      ]);

      setAppUsers(Array.isArray(usersResp) ? (usersResp as AppUser[]) : []);
      setActiveShift((shiftResp as ShiftDto | null) ?? null);
    } catch (err) {
      console.error("Failed to load users / shift", err);
      setError("Failed to load staff or shift info.");
    } finally {
      setLoading(false);
    }
  }

  // Map app_users -> Worker objects for UI
  const workersFromUsers: Worker[] = useMemo(
    () =>
      appUsers.map((u) => ({
        id: u.userId,
        workerId: u.workerId,
        name: u.name,
        role: u.role,
      })),
    [appUsers]
  );

  const allStations = stations && stations.length > 0 ? stations : DEMO_STATIONS;

  const allWorkers =
    workers && workers.length > 0
      ? workers
      : workersFromUsers.length > 0
      ? workersFromUsers
      : DEMO_WORKERS;

  const selectedStation = useMemo(
    () => allStations.find((s) => s.id === selectedStationId) ?? allStations[0],
    [allStations, selectedStationId]
  );

  const selectedWorker = useMemo(
    () => allWorkers.find((w) => w.id === selectedWorkerId) ?? null,
    [allWorkers, selectedWorkerId]
  );

  const filteredWorkers = useMemo(() => {
    const q = searchWorker.trim().toLowerCase();
    if (!q) return allWorkers;
    return allWorkers.filter((w) => w.name.toLowerCase().includes(q));
  }, [allWorkers, searchWorker]);

  const defaultBrief =
    "Tonight we expect a busy shift. Focus on fast service, upsell when possible, and keep an eye on large groups. Any issues, contact management.";

  function isGuid(v: string | null | undefined) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function handleConfirmShift() {
  if (!selectedWorker || pinInput.trim().length === 0) return;

  if (!activeShift || activeShift.status !== "active") {
    setError("No active shift. Ask manager to start a shift on the Dashboard.");
    return;
  }

  // Guard: make sure we actually have a real workerId (GUID)
  if (!isGuid(selectedWorker.workerId)) {
    setError(
      "Selected user has no linked workerId. Make sure /api/auth/users returns workerId (GUID) for each user."
    );
    return;
  }

  try {
    setBusy(true);
    setError(null);

    // 1) verify PIN
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: { userId: selectedWorker.id, passcode: pinInput.trim() },
    });

    // 2) clock in/out using the *workerId* (GUID)
    const workerId = selectedWorker.workerId!;
    const shiftId = activeShift.shiftId;

    if (shiftPanelMode === "start") {
      await apiFetch(`/api/shifts/${shiftId}/workers/clock-in`, {
        method: "POST",
        body: {
          workerId, // must be a GUID
          // stationId can be omitted if your stations are demo strings
          stationId:
            deviceMode === "fixed" && isGuid(selectedStation?.id)
              ? (selectedStation!.id as string)
              : undefined,
          deviceType: deviceMode, // "fixed" | "personal"
        },
      });
      onStart?.();
    } else {
      await apiFetch(`/api/shifts/${shiftId}/workers/clock-out`, {
        method: "POST",
        body: { workerId },
      });
      onEnd?.();
    }

    // reset
    setShiftPanelMode(null);
    setSearchWorker("");
    setSelectedWorkerId(null);
    setPinInput("");
  } catch (err) {
    console.error("Shift action failed", err);
    setError("Failed to update shift. Check PIN or ask manager.");
  } finally {
    setBusy(false);
  }
}


  function handleCancelShift() {
    setShiftPanelMode(null);
    setSearchWorker("");
    setSelectedWorkerId(null);
    setPinInput("");
    setError(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      {/* Page title */}
      <h2 className="text-2xl font-semibold tracking-tight">
        {title ?? "Home"}
      </h2>

      {loading && (
        <div className="text-xs text-gray-500">
          Loading staff / shift info…
        </div>
      )}
      {error && (
        <div className="text-xs text-red-600">
          {error}
        </div>
      )}

      {/* 1. Top: Device info + switch button (simulate tablet type) */}
      <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Device
            </div>
            {deviceMode === "fixed" ? (
              <>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  Fixed Tablet: {selectedStation?.name ?? "Select station"}
                </div>
                <div className="text-xs text-gray-500">
                  This tablet is assigned to a station. Personal stats are shown
                  on personal devices.
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  Personal Device
                </div>
                <div className="text-xs text-gray-500">
                  Staff logs in with PIN. This device shows their shift stats.
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {/* Quick simulation toggle */}
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="text-[11px] uppercase tracking-wide">
                Simulate:
              </span>
              <button
                type="button"
                onClick={() => setDeviceMode("fixed")}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (deviceMode === "fixed"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                }
              >
                Fixed
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode("personal")}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (deviceMode === "personal"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                }
              >
                Personal
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeviceSelector((v) => !v)}
            >
              {deviceMode === "fixed"
                ? "Change station / switch mode"
                : "Change mode / device"}
            </Button>
          </div>
        </div>

        {showDeviceSelector && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Device configuration
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="deviceMode"
                    className="h-3 w-3"
                    checked={deviceMode === "fixed"}
                    onChange={() => setDeviceMode("fixed")}
                  />
                  Fixed tablet
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="deviceMode"
                    className="h-3 w-3"
                    checked={deviceMode === "personal"}
                    onChange={() => setDeviceMode("personal")}
                  />
                  Personal device
                </label>
              </div>

              {deviceMode === "fixed" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Station:</span>
                  <select
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs"
                    value={selectedStation?.id ?? ""}
                    onChange={(e) => setSelectedStationId(e.target.value)}
                  >
                    {allStations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {deviceMode === "personal" && (
                <div className="text-xs text-gray-500">
                  Staff logs in via the shift panel below using their PIN.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Shift panel: start / end + (for personal) stats area */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Left: start/end shift actions */}
          <div>
            <div className="text-sm font-semibold text-gray-800">
              Shift Control
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Staff use this panel to start and end their shifts using a PIN.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setShiftPanelMode("start");
                  setSearchWorker("");
                  setSelectedWorkerId(null);
                  setPinInput("");
                  setError(null);
                }}
              >
                Start Shift
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShiftPanelMode("end");
                  setSearchWorker("");
                  setSelectedWorkerId(null);
                  setPinInput("");
                  setError(null);
                }}
              >
                End Shift
              </Button>
            </div>
          </div>

          {/* Right: personal device stats placeholder */}
          {deviceMode === "personal" ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-800">
                My Shift (Personal)
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <StatTile label="Time on shift" value="—" />
                <StatTile label="Sales" value="—" />
                <StatTile label="Tips" value="—" />
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Later, this panel will show live stats for the logged-in staff
                member: total sales, tips, and time on shift.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-800">
                Fixed Tablet
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                This tablet is bound to <b>{selectedStation?.name}</b>. Personal
                stats will be visible on staff personal devices.
              </div>
            </div>
          )}
        </div>

        {/* Worker selection + PIN area (shown after clicking start/end) */}
        {shiftPanelMode && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-800">
                  {shiftPanelMode === "start" ? "Start shift" : "End shift"}
                </div>
                <div className="text-xs text-gray-500">
                  Choose worker and enter PIN to{" "}
                  {shiftPanelMode === "start" ? "start" : "end"} their shift.
                </div>
              </div>
              <Button type="button" variant="ghost" onClick={handleCancelShift}>
                Cancel
              </Button>
            </div>

            {/* Search + worker list */}
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <input
                  type="text"
                  placeholder="Search worker..."
                  value={searchWorker}
                  onChange={(e) => setSearchWorker(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                  {filteredWorkers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500">
                      No workers found.
                    </div>
                  )}
                  {filteredWorkers.map((w) => {
                    const active = selectedWorkerId === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWorkerId(w.id)}
                        className={
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm " +
                          (active
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-800 hover:bg-gray-100")
                        }
                      >
                        <span>{w.name}</span>
                        {w.role && (
                          <span
                            className={
                              "text-xs " +
                              (active ? "text-gray-200" : "text-gray-500")
                            }
                          >
                            {w.role}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PIN + confirm */}
              <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">
                  {selectedWorker
                    ? `Worker: ${selectedWorker.name}`
                    : "Select a worker from the list"}
                </div>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="Enter PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirmShift}
                  disabled={
                    busy || !selectedWorker || pinInput.trim().length === 0
                  }
                >
                  {busy
                    ? "Working…"
                    : `Confirm ${
                        shiftPanelMode === "start" ? "Start" : "End"
                      } Shift`}
                </Button>
                <div className="text-[11px] text-gray-500">
                  PIN is validated against the user&apos;s personal code, then
                  we clock them in/out in the active shift.
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Brief (read-only) */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-gray-700">Brief</div>
        <textarea
          className="min-h-[120px] w-full resize-none rounded-xl border border-gray-300 bg-gray-50 p-3 text-sm text-gray-800"
          value={briefText ?? defaultBrief}
          readOnly
        />
        <div className="mt-1 text-xs text-gray-500">
          This brief can only be edited by a manager from the Management page.
        </div>
      </section>
    </div>
  );
}

/* Small stat tile used in the personal panel */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
