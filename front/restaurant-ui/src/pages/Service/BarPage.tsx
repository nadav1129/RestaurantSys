// src/pages/BarPage.tsx
import { useEffect, useState } from "react";
import StationServicePage from "../StationServicePage";
import { apiFetch } from "../../api/api";
import type { Station, TableInfo, InventoryItem } from "../../types/";

/* Still mocked until you have a real inventory endpoint */
const mockInv: InventoryItem[] = [
  { id: "gin", name: "Gin", qty: 4 },
  { id: "vodka", name: "Vodka", qty: 6 },
  { id: "rum", name: "Rum", qty: 5 },
  { id: "tonic", name: "Tonic", qty: 12 },
];

type BarPageProps = {
  station: Station;
  onOpenOrderForTable: (tableNum: string) => void; /* required */
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
        // Expected DTO: { tableId: string; tableNum: number }[]
        const data = (await apiFetch(
          `/api/stations/${station.stationId}/tables`,
          { method: "GET" }
        )) as { tableId: string; tableNum: number }[] | null;

        if (cancelled) return;

        // Use the TABLE NUMBER as TableInfo.id so clicking can just pass id
        const mapped: TableInfo[] =
          data?.map((t) => ({
            id: String(t.tableNum),      /* <- this is the table number */
            owner: `Table ${t.tableNum}`,
            total: 0,
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

  /** Normalize whatever StationServicePage passes to a table number string */
  function handleOpen(payload: unknown) {
    // Most correct case: StationServicePage calls with table.id (already tableNum as string)
    if (typeof payload === "string" && payload.trim() !== "") {
      persistAndForward(payload);
      return;
    }

    // If StationServicePage sends the whole table object
    if (payload && typeof payload === "object") {
      const t = payload as any;
      // Try common fields in order
      if (typeof t.id === "string" && t.id.trim() !== "") {
        persistAndForward(t.id);
        return;
      }
      if (typeof t.tableNum === "number" || typeof t.tableNum === "string") {
        persistAndForward(String(t.tableNum));
        return;
      }
      if (typeof t.owner === "string") {
        const match = t.owner.match(/\d+/); // e.g., "Table 12" -> "12"
        if (match) {
          persistAndForward(match[0]);
          return;
        }
      }
    }

    console.warn("[BarPage] Could not resolve table number from click payload:", payload);
  }

  function persistAndForward(num: string) {
    try { sessionStorage.setItem("lastTableNum", num); } catch {}
    onOpenOrderForTable(num);
  }

  if (error) {
    console.warn("BarPage tables error:", error);
  }

  return (
    <StationServicePage
      station={station}
      tables={tables}
      inventory={mockInv}
      // IMPORTANT: we pass our defensive wrapper
      onOpenOrderForTable={handleOpen}
    />
  );
}
