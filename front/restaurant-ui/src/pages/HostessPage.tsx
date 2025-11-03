// File: src/pages/HostessPage.tsx
import React, { useState } from "react";
import Button from "../components/Button";
import type { TableBlacklist, SimpleEntry } from "../types";

type Tab = "tables" | "entry" | "blacklist";

const mockTables: TableBlacklist[] = [
  { id: "t1", name: "Nadav", note: "Birthday", min: 150, tableId: "12" },
  { id: "t2", name: "Noa", note: "VIP", min: 300, tableId: "3" },
];
const mockEntry: SimpleEntry[] = [
  { id: "e1", name: "Eli", note: "Walk-in" },
  { id: "e2", name: "Maya", note: "Reservation 21:30" },
];
const mockBlacklist: SimpleEntry[] = [
  { id: "b1", name: "Guy", note: "Chargeback history" },
];

export default function HostessPage() {
  const [tab, setTab] = useState<Tab>("tables");

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "tables" ? "primary" : "secondary"} onClick={() => setTab("tables")}>
          Tables
        </Button>
        <Button variant={tab === "entry" ? "primary" : "secondary"} onClick={() => setTab("entry")}>
          Entry
        </Button>
        <Button variant={tab === "blacklist" ? "primary" : "secondary"} onClick={() => setTab("blacklist")}>
          Blacklist
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {tab === "tables" && (
          <ListTables data={mockTables} />
        )}
        {tab === "entry" && (
          <ListPeople title="Entry" data={mockEntry} />
        )}
        {tab === "blacklist" && (
          <ListPeople title="Blacklist" data={mockBlacklist} />
        )}
      </div>
    </div>
  );
}

function ListTables({ data }: { data: TableBlacklist[] }) {
  return (
    <>
      <div className="mb-3 text-sm font-semibold">Reserved / Seated Tables</div>
      <ul className="divide-y">
        {data.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-gray-500">
                ID: {t.id} · Table: {t.tableId ?? "-"} · Min: ₪{t.min ?? 0}
              </div>
              {t.note && <div className="text-xs text-gray-600">{t.note}</div>}
            </div>
            <Button variant="secondary">Details</Button>
          </li>
        ))}
      </ul>
    </>
  );
}

function ListPeople({ title, data }: { title: string; data: SimpleEntry[] }) {
  return (
    <>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <ul className="divide-y">
        {data.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">ID: {p.id}</div>
              {p.note && <div className="text-xs text-gray-600">{p.note}</div>}
            </div>
            <Button variant="secondary">Details</Button>
          </li>
        ))}
      </ul>
    </>
  );
}
