// File: src/pages/StationServicePage.tsx
import React, { useState } from "react";
import Button from "../components/Button";
import type { TableInfo, InventoryItem, Station } from "../types";
import { formatMoney } from "../utils/money";

export default function StationServicePage({
  station,
  tables,
  inventory,
  onOpenOrderForTable,
}: {
  station: Station;
  tables: TableInfo[];
  inventory: InventoryItem[];
  onOpenOrderForTable: (tableId: string) => void;
}) {
  const [showInv, setShowInv] = useState(false);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4">
        <div className="text-lg font-semibold">
          {station.stationType} — {station.stationName} Service
        </div>

        <Button variant="secondary" onClick={() => setShowInv((v) => !v)}>
          {showInv ? "Hide Inventory" : `Show ${station.stationName} Inventory`}
        </Button>
      </div>

      {/* Inventory panel */}
      {showInv && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold">Inventory</div>
          {inventory.length === 0 ? (
            <div className="text-sm text-gray-400">No items yet.</div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {inventory.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="truncate">{it.name}</span>
                  <span className="font-medium">× {it.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tables list */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold">
          Tables ({station.stationName})
        </div>

        {tables.length === 0 ? (
          <div className="text-sm text-gray-400">No tables.</div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {tables.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => {
                    try {
                      sessionStorage.setItem(
                        "lastTableNum",
                        String(t.tableNum)
                      );
                      sessionStorage.setItem("lastTableId", t.id);
                    } catch {}

                    onOpenOrderForTable(t.id);
                  }}
                  className="relative w-full rounded-2xl border border-gray-200 bg-white p-3 text-left hover:border-gray-300 hover:bg-gray-50"
                >
                  {/* table number badge (top-right) */}
                  <div className="absolute right-2 top-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    {t.tableNum}
                  </div>

                  {/* main label: guest name */}
                  <div className="pr-10 text-sm font-semibold text-gray-900">
                    {t.owner?.trim() ? t.owner : "—"}
                  </div>

                  <div className="mt-1 text-xs text-gray-600">
                    Total:{" "}
                    <span className="font-medium">
                      ₪{formatMoney(t.total ?? 0)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
