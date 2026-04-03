import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/Button";
import { apiFetch } from "../../../api/api";
import type { CheckerStationSettings, RevenueCenter } from "../../../types";

export default function CheckerCard({
  stationId,
  stationName,
}: {
  stationId: string;
  stationName: string;
}) {
  const [revenueCenters, setRevenueCenters] = useState<RevenueCenter[]>([]);
  const [selectedRevenueCenterId, setSelectedRevenueCenterId] = useState<string>("");
  const [printEnabled, setPrintEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [centersResp, settingsResp] = await Promise.all([
          apiFetch("/api/revenue-centers"),
          apiFetch(`/api/stations/${stationId}/checker-settings`),
        ]);

        if (cancelled) return;

        const centers = Array.isArray(centersResp)
          ? (centersResp as RevenueCenter[])
          : [];
        const settings = (settingsResp as CheckerStationSettings | null) ?? null;

        setRevenueCenters(centers);
        setSelectedRevenueCenterId(settings?.revenueCenterId ?? "");
        setPrintEnabled(!!settings?.printEnabled);
      } catch (e) {
        console.error("Failed to load checker configuration", e);
        if (!cancelled) setError("Failed to load checker configuration.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [stationId]);

  const selectedRevenueCenter = useMemo(
    () =>
      revenueCenters.find(
        (center) => center.revenueCenterId === selectedRevenueCenterId
      ) ?? null,
    [revenueCenters, selectedRevenueCenterId]
  );

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);

      const saved = (await apiFetch(
        `/api/stations/${stationId}/checker-settings`,
        {
          method: "PUT",
          body: {
            revenueCenterId: selectedRevenueCenterId || null,
          },
        }
      )) as CheckerStationSettings | null;

      setSelectedRevenueCenterId(saved?.revenueCenterId ?? "");
      setPrintEnabled(!!saved?.printEnabled);
    } catch (e) {
      console.error("Failed to save checker configuration", e);
      setError("Failed to save checker configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
      <div className="mb-1 text-sm font-medium">Checker · {stationName}</div>
      <div className="text-xs text-gray-500">
        Choose the revenue center this checker owns so routed orders land on the
        right queue during service.
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Revenue Center
          </span>
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            value={selectedRevenueCenterId}
            disabled={loading || saving}
            onChange={(e) => setSelectedRevenueCenterId(e.target.value)}
          >
            <option value="">No revenue center</option>
            {revenueCenters.map((center) => (
              <option key={center.revenueCenterId} value={center.revenueCenterId}>
                {center.name}
              </option>
            ))}
          </select>
        </label>

        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "Saving..." : "Save Checker"}
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600">
        <div>
          Assigned center:{" "}
          <span className="font-medium text-gray-800">
            {selectedRevenueCenter?.name ?? "None"}
          </span>
        </div>
        <div className="mt-1">
          Print default:{" "}
          <span className="font-medium text-gray-800">
            {printEnabled ? "On" : "Off"}
          </span>
        </div>
        <div className="mt-1 text-gray-500">
          The Print toggle itself lives on the live Checker page.
        </div>
      </div>

      {error ? <div className="mt-3 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
