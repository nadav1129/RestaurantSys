// File: src/pages/InventoryPage.tsx
import React, { useState } from "react";
import Button from "../../components/Button";
import type { InventoryItem, Station } from "../../types";

type StationBlock = {
  station: Station;
  missing: InventoryItem[];
};

const mockData: StationBlock[] = [
  {
    station: "Bar",
    missing: [
      { id: "gin", name: "Gin", qty: 2 },
      { id: "vodka", name: "Vodka", qty: 1 },
    ],
  },
  {
    station: "Floor",
    missing: [
      { id: "napkins", name: "Napkins", qty: 50 },
      { id: "straws", name: "Straws", qty: 25 },
    ],
  },
  {
    station: "Hostess",
    missing: [{ id: "buzzers", name: "Buzzers", qty: 3 }],
  },
];

export default function InventoryPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const mark = (id: string) => setChecked((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-4">
      <div className="mb-4 text-lg font-semibold">Inventory — Missing Items</div>
      <div className="space-y-3">
        {mockData.map((block) => {
          const key = block.station;
          return (
            <div key={key} className="rounded-2xl border border-gray-200 bg-white">
              <button
                onClick={() => toggle(key)}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="text-sm font-medium">{block.station}</div>
                <div className="text-xs text-gray-500">
                  {open[key] ? "Hide" : "Show"} · Missing {block.missing.length} item(s)
                </div>
              </button>

              {open[key] && (
                <div className="border-t px-4 py-3">
                  {block.missing.length === 0 ? (
                    <div className="text-sm text-gray-400">No missing items 🎉</div>
                  ) : (
                    <ul className="space-y-2">
                      {block.missing.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!checked[m.id]}
                              onChange={() => mark(m.id)}
                            />
                            <span>{m.name}</span>
                          </label>
                          <span className="font-medium">× {m.qty}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary">Edit expected list for station</Button>
                    <Button variant="secondary">Edit missing products for station</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
