import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { RevenueCenterIcon, StationsIcon } from "../../components/icons";
import { apiFetch } from "../../api/api";
import {
  EmptyState,
  SectionCard,
  StatCard,
} from "../../components/ui/layout";
import type { RevenueCenter, Station } from "../../types";

type AssignSelectionMap = Record<string, string>;
type OpenMap = Record<string, boolean>;

export default function RevenueCentersPage() {
  const [revenueCenters, setRevenueCenters] = useState<RevenueCenter[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [openRows, setOpenRows] = useState<OpenMap>({});
  const [assignSelections, setAssignSelections] = useState<AssignSelectionMap>({});
  const [draftName, setDraftName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [centersResp, stationsResp] = await Promise.all([
        apiFetch("/api/revenue-centers"),
        apiFetch("/api/stations"),
      ]);

      const centers = Array.isArray(centersResp)
        ? (centersResp as RevenueCenter[])
        : [];
      const stationList = Array.isArray(stationsResp)
        ? (stationsResp as Station[])
        : [];

      setRevenueCenters(centers);
      setStations(stationList);
      setOpenRows((prev) => {
        const next: OpenMap = {};
        for (const center of centers) next[center.revenueCenterId] = !!prev[center.revenueCenterId];
        return next;
      });
    } catch (e) {
      console.error("Failed to load revenue centers", e);
      setError("Failed to load revenue centers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const eligibleStations = useMemo(
    () =>
      stations.filter(
        (station) => station.stationType === "Bar" || station.stationType === "Floor"
      ),
    [stations]
  );

  const unassignedStations = useMemo(
    () => eligibleStations.filter((station) => !station.revenueCenterId),
    [eligibleStations]
  );

  async function handleCreate() {
    const name = draftName.trim();
    if (!name) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch("/api/revenue-centers", {
        method: "POST",
        body: { name },
      });
      setDraftName("");
      await load();
    } catch (e) {
      console.error("Failed to create revenue center", e);
      setError("Failed to create revenue center.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(center: RevenueCenter) {
    const next = window.prompt("Rename revenue center", center.name)?.trim();
    if (!next || next === center.name) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/revenue-centers/${center.revenueCenterId}`, {
        method: "PATCH",
        body: { name: next },
      });
      await load();
    } catch (e) {
      console.error("Failed to rename revenue center", e);
      setError("Failed to rename revenue center.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(center: RevenueCenter) {
    const confirmed = window.confirm(
      `Delete "${center.name}"? Assigned stations and checker links will be cleared.`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/revenue-centers/${center.revenueCenterId}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      console.error("Failed to delete revenue center", e);
      setError("Failed to delete revenue center.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignStation(revenueCenterId: string) {
    const stationId = assignSelections[revenueCenterId];
    if (!stationId) return;

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/revenue-centers/${revenueCenterId}/stations`, {
        method: "POST",
        body: { stationId },
      });
      setAssignSelections((prev) => ({ ...prev, [revenueCenterId]: "" }));
      await load();
    } catch (e) {
      console.error("Failed to assign station to revenue center", e);
      setError("Failed to assign station.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveStation(revenueCenterId: string, stationId: string) {
    try {
      setSaving(true);
      setError(null);
      await apiFetch(
        `/api/revenue-centers/${revenueCenterId}/stations/${stationId}`,
        { method: "DELETE" }
      );
      await load();
    } catch (e) {
      console.error("Failed to remove station from revenue center", e);
      setError("Failed to remove station.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Revenue Centers"
        description="Group floor and bar stations into routing buckets, then point a checker station at the right center."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rs-input min-w-[240px]"
              placeholder="New revenue center name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={saving || !draftName.trim()}>
              Add Revenue Center
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard
              label="Revenue Centers"
              value={revenueCenters.length}
              hint="Each center owns a controlled set of floor/bar stations."
            />
            <StatCard
              label="Eligible Stations"
              value={eligibleStations.length}
              hint="Only Bar and Floor stations can join a revenue center."
            />
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <RevenueCenterIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Routing stays backend-driven
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  Assign floor/bar stations here, then map checker stations from the Stations tab for deterministic order routing.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                Loading revenue centers...
              </div>
            ) : revenueCenters.length === 0 ? (
              <EmptyState
                title="No revenue centers yet"
                description="Create your first revenue center to start grouping stations for checker routing."
              />
            ) : (
              revenueCenters.map((center) => {
                const isOpen = !!openRows[center.revenueCenterId];
                return (
                  <div
                    key={center.revenueCenterId}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--card)]"
                  >
                    <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          {center.name}
                        </div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {center.stations.length} assigned station
                          {center.stations.length === 1 ? "" : "s"}
                          {center.checkerStations.length > 0
                            ? ` · Checkers: ${center.checkerStations
                                .map(
                                  (checker) =>
                                    `${checker.stationName} (${checker.productScope})`
                                )
                                .join(", ")}`
                            : " · No checker station selected yet"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setOpenRows((prev) => ({
                              ...prev,
                              [center.revenueCenterId]: !prev[center.revenueCenterId],
                            }))
                          }
                        >
                          {isOpen ? "Collapse" : "Expand"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => void handleRename(center)}
                          disabled={saving}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDelete(center)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="border-t border-[var(--border)] px-5 py-4">
                        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                              <StationsIcon className="h-4 w-4" />
                              Assigned Stations
                            </div>
                            {center.stations.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
                                No floor or bar stations are attached to this revenue center yet.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {center.stations.map((station) => (
                                  <div
                                    key={station.stationId}
                                    className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div>
                                      <div className="text-sm font-medium text-[var(--foreground)]">
                                        {station.stationName}
                                      </div>
                                      <div className="text-xs text-[var(--muted-foreground)]">
                                        {station.stationType}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      onClick={() =>
                                        void handleRemoveStation(
                                          center.revenueCenterId,
                                          station.stationId
                                        )
                                      }
                                      disabled={saving}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4">
                            <div className="text-sm font-semibold text-[var(--foreground)]">
                              Add station
                            </div>
                            <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                              Only currently unassigned Bar/Floor stations appear here.
                            </div>

                            <div className="mt-4 space-y-3">
                              <select
                                className="rs-select"
                                value={assignSelections[center.revenueCenterId] ?? ""}
                                onChange={(e) =>
                                  setAssignSelections((prev) => ({
                                    ...prev,
                                    [center.revenueCenterId]: e.target.value,
                                  }))
                                }
                                disabled={saving || unassignedStations.length === 0}
                              >
                                <option value="">
                                  {unassignedStations.length === 0
                                    ? "No unassigned stations"
                                    : "Select a station..."}
                                </option>
                                {unassignedStations.map((station) => (
                                  <option key={station.stationId} value={station.stationId}>
                                    {station.stationName} ({station.stationType})
                                  </option>
                                ))}
                              </select>

                              <Button
                                onClick={() => void handleAssignStation(center.revenueCenterId)}
                                disabled={
                                  saving || !(assignSelections[center.revenueCenterId] ?? "")
                                }
                              >
                                Assign Station
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {error ? (
              <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
