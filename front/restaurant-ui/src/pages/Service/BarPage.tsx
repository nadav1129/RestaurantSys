// src/pages/BarPage.tsx
import { useEffect, useState } from "react";
import StationServicePage from "../StationServicePage";
import { apiFetch } from "../../api/api";
import type { Station, TableInfo, InventoryItem } from "../../types/";
import { normalizeMoney as normalizePrice } from "../../utils/money";

/* Still mocked until you have a real inventory endpoint */
const mockInv: InventoryItem[] = [
  { id: "gin", name: "Gin", qty: 4 },
  { id: "vodka", name: "Vodka", qty: 6 },
  { id: "rum", name: "Rum", qty: 5 },
  { id: "tonic", name: "Tonic", qty: 12 },
];

type BarPageProps = {
  station: Station;

  /* IMPORTANT: should be tableId (GUID) */
  onOpenOrderForTable: (tableId: string) => void;
};

type TablesDto = { tableId: string; tableNum: number };
type ActiveShiftDto = { shiftId: string; openedAt: string } | null;

type ActiveOrderDto = {
  orderId: string | null;
  items: {
    productId: string;
    name: string;
    qty: number;
    unitPrice: number | string;
  }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function BarPage({
  station,
  onOpenOrderForTable,
}: BarPageProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [rawTables, setRawTables] = useState<TablesDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load station tables */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = (await apiFetch(
          `/api/stations/${station.stationId}/tables`,
          { method: "GET" }
        )) as TablesDto[] | null;

        if (cancelled) return;

        const list = data ?? [];
        setRawTables(list);

        const mapped: TableInfo[] = list.map((t) => ({
          id: t.tableId /* keep GUID */,
          tableNum: t.tableNum,
          owner: "-" /* will be filled later if needed */,
          total: 0 /* will be filled next effect */,
        }));

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

  /* Fill totals per table (sum of open order items) */
  useEffect(() => {
    let cancelled = false;

    if (rawTables.length === 0) return;

    (async () => {
      try {
        const shift = await apiFetch<ActiveShiftDto>("/api/shifts/active");
        if (!shift?.shiftId) return;

        /* For each table, fetch its active order and sum qty * unitPrice */
        const pairs = await Promise.all(
          rawTables.map(async (t) => {
            try {
              const res = await apiFetch<ActiveOrderDto>(
                `/api/orders/active?shiftId=${encodeURIComponent(
                  shift.shiftId
                )}&tableId=${encodeURIComponent(t.tableId)}`
              );

              const sum = (res?.items ?? []).reduce((acc, it) => {
                const raw = Number(it.unitPrice);
                const unit =
                  normalizePrice(Number.isFinite(raw) ? raw : 0) ?? 0;
                return acc + (it.qty || 0) * unit;
              }, 0);

              return [t.tableId, round2(sum)] as const;
            } catch {
              return [t.tableId, 0] as const;
            }
          })
        );

        if (cancelled) return;

        const totalById = new Map<string, number>(pairs);
        setTables((prev) =>
          prev.map((x) => ({
            ...x,
            total: totalById.get(x.id) ?? 0,
          }))
        );
      } catch (e) {
        console.error("Failed to load table totals", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawTables]);

  /* Fill guest name per table (does NOT overwrite totals) */
useEffect(() => {
  let cancelled = false;

  if (rawTables.length === 0) return;

  (async () => {
    try {
      const shift = await apiFetch<ActiveShiftDto>("/api/shifts/active");
      if (!shift?.shiftId) return;

      const orders = await apiFetch<any[]>(
        `/api/shifts/${encodeURIComponent(shift.shiftId)}/orders`
      );

      const byTableId = new Map<string, string>();
      for (const o of orders ?? []) {
        if (o.status !== "open") continue;
        if (!o.tableId) continue;

        const guest = (o.guestName ?? "").trim();
        if (guest) byTableId.set(o.tableId, guest);
      }

      if (cancelled) return;

      setTables((prev) =>
        prev.map((t) => ({
          ...t,
          owner: byTableId.get(t.id) ?? t.owner ?? "—",
        }))
      );
    } catch (e) {
      console.error("Failed to load guest names", e);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [rawTables.length, station.stationId]);


  /** Normalize whatever StationServicePage passes to a tableId string */
  function handleOpen(payload: unknown) {
    if (typeof payload === "string" && payload.trim() !== "") {
      onOpenOrderForTable(payload);
      return;
    }

    if (payload && typeof payload === "object") {
      const t = payload as any;
      if (typeof t.id === "string" && t.id.trim() !== "") {
        onOpenOrderForTable(t.id);
        return;
      }
    }

    console.warn(
      "[BarPage] Could not resolve tableId from click payload:",
      payload
    );
  }

  if (error) console.warn("BarPage tables error:", error);

  return (
    <StationServicePage
      station={station}
      tables={tables}
      inventory={mockInv}
      onOpenOrderForTable={handleOpen}
    />
  );
}
