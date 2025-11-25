import React, { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import { apiFetch } from "../api/api";

type WorkerDto = {
  workerId: string;
  firstName: string;
  lastName: string;
  personalId?: string | null;
  email?: string | null;
  phone?: string | null;
  position: string;
  salaryCents: number | null;
  createdAt: string;
};

type SortKey = "name" | "position" | "created_at";
type SortDir = "asc" | "desc";

type CreateWorkerResponse = {
  worker: WorkerDto;
  loginCode: string; // 4-digit code worker will take to LoginPage
};

type ConfirmConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

export default function StaffPage() {
  const [workers, setWorkers] = useState<WorkerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showAdd, setShowAdd] = useState(false);
  const [profileWorker, setProfileWorker] = useState<WorkerDto | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newPersonalId, setNewPersonalId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSalary, setNewSalary] = useState(""); // in NIS as string

  const [creating, setCreating] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);
  const [lastCreatedWorker, setLastCreatedWorker] = useState<WorkerDto | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = (await apiFetch("/api/workers")) as WorkerDto[];
        if (!cancelled) {
          setWorkers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load workers", err);
        if (!cancelled) setError("Failed to load workers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSortedWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = workers;
    if (q) {
      list = list.filter((w) => {
        const fullName = `${w.firstName} ${w.lastName}`.toLowerCase();
        return (
          fullName.includes(q) ||
          w.position.toLowerCase().includes(q) ||
          (w.email ?? "").toLowerCase().includes(q) ||
          (w.phone ?? "").toLowerCase().includes(q)
        );
      });
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        const an = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
        cmp = an.localeCompare(bn);
      } else if (sortKey === "position") {
        cmp = a.position.toLowerCase().localeCompare(b.position.toLowerCase());
      } else if (sortKey === "created_at") {
        cmp =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [workers, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  }

  async function handleCreateWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !newPosition.trim())
      return;

    const salaryNis = newSalary.trim();
    let salaryCents: number | null = null;
    if (salaryNis) {
      const parsed = Number(salaryNis.replace(",", "."));
      if (!Number.isNaN(parsed) && parsed >= 0) {
        salaryCents = Math.round(parsed * 100);
      }
    }

    const body = {
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      position: newPosition.trim(),
      personalId: newPersonalId.trim() || null,
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      salaryCents,
    };

    try {
      setCreating(true);
      setError(null);

      // Expect backend to create worker + app_user + 4-digit login code
      const resp = (await apiFetch("/api/workers", {
        method: "POST",
        body: JSON.stringify(body),
      })) as CreateWorkerResponse;

      setWorkers((prev) => [...prev, resp.worker]);
      setShowAdd(false);
      setLastCreatedWorker(resp.worker);
      setLastCreatedCode(resp.loginCode);

      // reset form
      setNewFirstName("");
      setNewLastName("");
      setNewPosition("");
      setNewPersonalId("");
      setNewEmail("");
      setNewPhone("");
      setNewSalary("");
    } catch (err) {
      console.error("Failed to create worker", err);
      setError("Failed to create worker");
    } finally {
      setCreating(false);
    }
  }

  function askDeleteWorker(w: WorkerDto) {
    const fullName = `${w.firstName} ${w.lastName}`;
    setConfirm({
      title: "Remove worker?",
      message: `Are you sure you want to remove ${fullName} from staff?\nYou might also want to disable their login in auth users.`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        try {
          await apiFetch(`/api/workers/${w.workerId}`, {
            method: "DELETE",
          });
          setWorkers((prev) =>
            prev.filter((x) => x.workerId !== w.workerId)
          );
        } catch (err) {
          console.error("Failed to delete worker", err);
          setError("Failed to delete worker");
        }
      },
    });
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Management
            </div>
            <div className="text-xl font-semibold text-gray-900">
              Staff
            </div>
            <div className="text-xs text-gray-500">
              Manage workers, positions and login codes.
            </div>
            {error && (
              <div className="mt-1 text-xs text-red-600">{error}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdd(true)}
            >
              + Add worker
            </Button>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              placeholder="Search by name, position, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm md:max-w-md"
            />

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Sort by:</span>
              <SortButton
                label="Name"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => toggleSort("name")}
              />
              <SortButton
                label="Position"
                active={sortKey === "position"}
                dir={sortDir}
                onClick={() => toggleSort("position")}
              />
              <SortButton
                label="Date"
                active={sortKey === "created_at"}
                dir={sortDir}
                onClick={() => toggleSort("created_at")}
              />
            </div>
          </div>
        </div>

        {/* Workers list */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="text-sm text-gray-500">Loading staff…</div>
          ) : filteredSortedWorkers.length === 0 ? (
            <div className="text-sm text-gray-500">
              No workers found. Use &ldquo;Add worker&rdquo; to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Position</th>
                    <th className="px-2 py-2">Contact</th>
                    <th className="px-2 py-2">Created</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSortedWorkers.map((w) => (
                    <tr
                      key={w.workerId}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-2 py-2">
                        <div className="font-medium text-gray-900">
                          {w.firstName} {w.lastName}
                        </div>
                        {w.personalId && (
                          <div className="text-[11px] text-gray-500">
                            ID: {w.personalId}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-sm text-gray-800">
                          {w.position}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-xs text-gray-600">
                          {w.email && <div>{w.email}</div>}
                          {w.phone && <div>{w.phone}</div>}
                          {!w.email && !w.phone && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setProfileWorker(w)}
                          >
                            View profile
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => askDeleteWorker(w)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Last-created login code banner */}
        {lastCreatedWorker && lastCreatedCode && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            <div className="font-semibold">
              New worker created: {lastCreatedWorker.firstName}{" "}
              {lastCreatedWorker.lastName}
            </div>
            <div className="mt-1 text-xs">
              Staff Login Code:{" "}
              <span className="rounded-lg bg-white px-2 py-1 font-mono text-base tracking-[0.3em]">
                {lastCreatedCode}
              </span>
            </div>
            <div className="mt-1 text-xs text-indigo-800">
              Ask the worker to go to the Login page and enter this 4-digit code.
              The system will show their full name and then ask for their PIN.
            </div>
          </div>
        )}
      </div>

      {/* Add worker modal */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-900">
                Add worker
              </div>
              <div className="text-xs text-gray-500">
                Email, phone and ID are optional. Salary is monthly in ₪
                (we will store it as cents).
              </div>
            </div>

            <form className="space-y-3" onSubmit={handleCreateWorker}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    First name
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Position
                </label>
                <input
                  type="text"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Bartender, Floor, Kitchen, Checker…"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    ID (optional)
                  </label>
                  <input
                    type="text"
                    value={newPersonalId}
                    onChange={(e) => setNewPersonalId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Phone (optional)
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Salary (₪ / month, optional)
                </label>
                <input
                  type="text"
                  value={newSalary}
                  onChange={(e) => setNewSalary(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. 10000"
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Saving…" : "Save worker"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile panel */}
      {profileWorker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {profileWorker.firstName} {profileWorker.lastName}
                </div>
                <div className="text-xs text-gray-500">
                  {profileWorker.position}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileWorker(null)}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              {profileWorker.personalId && (
                <div>
                  <span className="text-xs font-medium text-gray-500">
                    ID:{" "}
                  </span>
                  {profileWorker.personalId}
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-gray-500">
                  Email:{" "}
                </span>
                {profileWorker.email || <span className="text-gray-400">—</span>}
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">
                  Phone:{" "}
                </span>
                {profileWorker.phone || <span className="text-gray-400">—</span>}
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">
                  Salary:{" "}
                </span>
                {profileWorker.salaryCents != null
                  ? `₪ ${(profileWorker.salaryCents / 100).toFixed(0)} / month`
                  : "—"}
              </div>
              <div className="text-xs text-gray-500">
                Created:{" "}
                {new Date(profileWorker.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Small confirm panel at bottom */}
      {confirm && (
        <ConfirmPanel
          config={confirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-xs font-medium " +
        (active
          ? "bg-gray-900 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200")
      }
    >
      {label}
      {active && (dir === "asc" ? " ↑" : " ↓")}
    </button>
  );
}

function ConfirmPanel({
  config,
  onCancel,
}: {
  config: ConfirmConfig;
  onCancel: () => void;
}) {
  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
  } = config;
  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto mx-4 max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-xs text-gray-600 whitespace-pre-line">
          {message}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
