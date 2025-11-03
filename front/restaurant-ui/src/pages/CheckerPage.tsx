// File: src/pages/CheckerPage.tsx
import React, { useMemo, useState } from "react";
import Button from "../components/Button";
import type { Meal } from "../types";

type TableMeals = {
  tableId: string;
  meals: { id: string; name: string; qty: number; done: number }[]; // done <= qty
};

// Mock data
const initial: TableMeals[] = [
  {
    tableId: "12",
    meals: [
      { id: "m1", name: "Burger", qty: 2, done: 0 },
      { id: "m2", name: "Fries", qty: 1, done: 0 },
    ],
  },
  {
    tableId: "3",
    meals: [
      { id: "m2", name: "Fries", qty: 3, done: 1 },
      { id: "m3", name: "Salad", qty: 2, done: 0 },
    ],
  },
];

export default function CheckerPage() {
  const [tables, setTables] = useState<TableMeals[]>(initial);

  // Aggregate “remaining” per meal across all tables
  const remaining = useMemo(() => {
    const map = new Map<string, Meal>();
    for (const t of tables) {
      for (const m of t.meals) {
        const rem = m.qty - m.done;
        if (rem <= 0) continue;
        const prev = map.get(m.name);
        if (prev) {
          prev.qty += rem;
        } else {
          map.set(m.name, { id: m.id, name: m.name, qty: rem, tableId: "" });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tables]);

  const toggleOne = (tableId: string, mealId: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.tableId !== tableId) return t;
        return {
          ...t,
          meals: t.meals.map((m) =>
            m.id !== mealId ? m : { ...m, done: Math.min(m.qty, m.done + 1) }
          ),
        };
      })
    );
  };

  const revertOne = (tableId: string, mealId: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.tableId !== tableId) return t;
        return {
          ...t,
          meals: t.meals.map((m) =>
            m.id !== mealId ? m : { ...m, done: Math.max(0, m.done - 1) }
          ),
        };
      })
    );
  };

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[2fr_1fr]">
      {/* Left: tables & their meals */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Tables</div>
        <ul className="space-y-4">
          {tables.map((t) => (
            <li key={t.tableId} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-2 font-semibold">Table #{t.tableId}</div>
              <ul className="space-y-2">
                {t.meals.map((m) => {
                  const rem = m.qty - m.done;
                  return (
                    <li key={m.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-500">
                          Ordered: {m.qty} · Received: {m.done} · Remaining: {rem}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => revertOne(t.tableId, m.id)}
                          disabled={m.done === 0}
                        >
                          −
                        </Button>
                        <Button
                          onClick={() => toggleOne(t.tableId, m.id)}
                          disabled={m.done >= m.qty}
                        >
                          +
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: kitchen summary (remaining) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Kitchen Queue (Remaining)</div>
        {remaining.length === 0 ? (
          <div className="text-sm text-gray-400">All done 🙌</div>
        ) : (
          <ul className="space-y-2">
            {remaining.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <span>{m.name}</span>
                <span className="font-medium">× {m.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
