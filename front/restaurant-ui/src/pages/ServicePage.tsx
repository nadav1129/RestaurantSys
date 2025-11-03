// File: src/pages/ServicePage.tsx
import React from "react";
import SecondaryBar from "../components/SecondaryBar";
import BarPage from "./BarPage";
import FloorPage from "./FloorPage";
import HostessPage from "./HostessPage";
import CheckerPage from "./CheckerPage";
import InventoryPage from "./InventoryPage";

type StationVm = { id: string; name: string };

export default function ServicePage({
  stations,
  activeStationId,
  onStationChange,
  onOpenOrderForTable,
}: {
  stations: StationVm[];
  activeStationId?: string;
  onStationChange: (id: string) => void;
  onOpenOrderForTable: (tableId: string) => void;
}) {
  const renderActive = () => {
    switch (activeStationId) {
      case "bar":
        return <BarPage onOpenOrderForTable={onOpenOrderForTable} />;
      case "floor":
        return <FloorPage onOpenOrderForTable={onOpenOrderForTable} />;
      case "hostess":
        return <HostessPage />;
      case "checker":
        return <CheckerPage />;
      case "inventory":
        return <InventoryPage />;
      default:
        return (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            Choose a station to get station-specific shortcuts and views.
          </div>
        );
    }
  };

  return (
    <>
      <SecondaryBar
        title="Stations"
        items={stations.map((s) => ({ id: s.id, label: s.name }))}
        activeId={activeStationId}
        onChange={onStationChange}
        topOffsetClass="top-0" // <-- sticky to ScrollView’s top
      />
      <div className="mx-auto max-w-[1400px] px-4 py-6">{renderActive()}</div>
    </>
  );
}
