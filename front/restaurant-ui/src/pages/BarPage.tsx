// src/pages/BarPage.tsx
import { useEffect, useState } from "react";
import StationServicePage from "./StationServicePage";
import { apiFetch } from "../api/api";
import type { Station, TableInfo, InventoryItem } from "../types/";

/* For now: still mock inventory until we have a real inventory endpoint */
const mockInv: InventoryItem[] = [
  { id: "gin", name: "Gin", qty: 4 },
  { id: "vodka", name: "Vodka", qty: 6 },
  { id: "rum", name: "Rum", qty: 5 },
  { id: "tonic", name: "Tonic", qty: 12 },
];

type BarPageProps = {
  station: Station;
  onOpenOrderForTable: (tableId: string) => void;
};

export default function BarPage({ station, onOpenOrderForTable }: BarPageProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Backend: GET /api/stations/{stationId}/tables
        const data = (await apiFetch(
          `/api/stations/${station.stationId}/tables`,
          { method: "GET" }
        )) as { tableId: string; tableNum: number }[] | null;

        if (cancelled) return;

        const mapped: TableInfo[] =
          data?.map((t) => ({
            id: t.tableId,                // backend table_id
            owner: `Table ${t.tableNum}`, // label for UI
            total: 0,                     // will be filled when we hook orders
          })) ?? [];

        setTables(mapped);
      } catch (e) {
        console.error("Failed to load bar tables", e);
        if (!cancelled) setError("Failed to load tables.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [station.stationId]);

  if (error) {
    // optional: show it in UI instead of just logging
    console.warn("BarPage tables error:", error);
  }

  return (
    <StationServicePage
      station={station}
      tables={tables}
      inventory={mockInv}
      onOpenOrderForTable={onOpenOrderForTable}
    />
  );
}
