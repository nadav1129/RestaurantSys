// src/pages/ServicePage.tsx
import { useEffect, useMemo, useState } from "react";
import SecondaryBar from "../../components/SecondaryBar";
import BarPage from "./BarPage";
import HostessPage from "./HostessPage";
import CheckerPage from "./CheckerPage";
//import InventoryPage from "../Temp/InventoryPage";
import { apiFetch } from "../../api/api";
import type { Station } from "../../types/index";

/* ===== Backend DTO ===== */

export default function ServicePage({
  /* keep props for compatibility, but we’ll load from API */
  activeStationId,
  onStationChange,
  onOpenOrderForTable, /* <- parent provides this, we forward to table-based stations */
}: {
  activeStationId?: string;
  onStationChange?: (id: string) => void;
  onOpenOrderForTable: (tableNum: string) => void;
}) {
  const [stations, setStations] = useState<Station[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(activeStationId);
  const [loading, setLoading] = useState(false);

  /* load stations from backend */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = (await apiFetch("/api/stations", {
          method: "GET",
        })) as Station[] | null;
        setStations(data ?? []);
        /* set default active if none selected */
        if (!activeStationId && (data?.length ?? 0) > 0) {
          setActiveId(data![0].stationId);
        }
      } catch (err) {
        console.error("Failed to load stations", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeStationId]);

  /* keep external selection in sync if parent changes it */
  useEffect(() => {
    if (activeStationId) setActiveId(activeStationId);
  }, [activeStationId]);

  const activeStation = useMemo(
    () => stations.find((s) => s.stationId === activeId),
    [stations, activeId]
  );

  const items = useMemo(
    () =>
      stations.map((s) => ({
        id: s.stationId,
        label: `${s.stationType} · ${s.stationName}`,
      })),
    [stations]
  );

  function handleChange(id: string) {
    setActiveId(id);
    onStationChange?.(id);
  }

  function renderActive() {
    if (!activeStation) {
      if (loading)
        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-600">
            Loading stations…
          </div>
        );
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          {stations.length === 0
            ? "No stations yet."
            : "Choose a station to get station-specific shortcuts and views."}
        </div>
      );
    }

    switch (activeStation.stationType) {
      case "Bar":
      case "Floor":
        return (
          <BarPage
            station={activeStation}
            onOpenOrderForTable={onOpenOrderForTable}
          />
        );
      case "Hostes":
      case "selector":
        return <HostessPage stationId={activeStation.stationId} />;
      case "Checker":
        return <CheckerPage />;
      /* placeholders for the rest */
      case "Kitchen":
      case "Storage":
      case "Managment":
        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-700">
            {activeStation.stationType} page coming soon.
          </div>
        );
      //default:
        //return <InventoryPage />;
    }
  }

  return (
    <>
      <SecondaryBar
        title="Stations"
        items={items}
        activeId={activeId}
        onChange={handleChange}
        topOffsetClass="top-0"
      />
      <div className="mx-auto max-w-[1400px] px-4 py-6">{renderActive()}</div>
    </>
  );
}
