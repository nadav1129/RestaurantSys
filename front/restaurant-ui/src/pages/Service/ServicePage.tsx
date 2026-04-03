import { useEffect, useMemo, useState } from "react";
import SecondaryBar from "../../components/SecondaryBar";
import BarPage from "./BarPage";
import HostessPage from "./HostessPage";
import CheckerPage from "./CheckerPage";
import { apiFetch } from "../../api/api";
import type { Station } from "../../types/index";
import { EmptyState, PageContainer } from "../../components/ui/layout";

export default function ServicePage({
  activeStationId,
  onStationChange,
  onOpenOrderForTable,
}: {
  activeStationId?: string;
  onStationChange?: (id: string) => void;
  onOpenOrderForTable: (tableNum: string) => void;
}) {
  const [stations, setStations] = useState<Station[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(activeStationId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = (await apiFetch("/api/stations", {
          method: "GET",
        })) as Station[] | null;
        setStations(data ?? []);
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
      if (loading) {
        return (
          <PageContainer>
            <div className="rs-surface p-6 text-sm text-[var(--muted-foreground)]">
              Loading stations...
            </div>
          </PageContainer>
        );
      }

      return (
        <PageContainer>
          <EmptyState
            title={stations.length === 0 ? "No stations yet" : "Choose a station"}
            description={
              stations.length === 0
                ? "Once stations are available, they’ll appear here in the redesigned service navigation."
                : "Pick a station from the bar above to load its service-specific tools."
            }
          />
        </PageContainer>
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
      case "Kitchen":
      case "Storage":
      case "Managment":
        return (
          <PageContainer>
            <EmptyState
              title={`${activeStation.stationType} workspace coming soon`}
              description="The service shell is ready, and this station type can plug into it when its frontend is implemented."
            />
          </PageContainer>
        );
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
      <div className="pb-8">{renderActive()}</div>
    </>
  );
}
