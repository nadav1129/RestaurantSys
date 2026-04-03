import { useState } from "react";
import Button from "../components/Button";
import { OrdersIcon, TableIcon } from "../components/icons";
import { PageContainer, SectionCard, StatCard } from "../components/ui/layout";
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
    <PageContainer className="space-y-6">
      <SectionCard
        title={`${station.stationType} · ${station.stationName}`}
        description="A calmer station view for table scanning, order opening, and inventory awareness."
        actions={
          <Button variant="secondary" onClick={() => setShowInv((value) => !value)}>
            {showInv ? "Hide Inventory" : "Show Inventory"}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Tables" value={tables.length} hint="Available service points in this station." />
          <StatCard label="Inventory Items" value={inventory.length} hint="Quick view of what this station keeps on hand." />
          <StatCard label="Open Orders" value="Live" hint="Open a table card below to continue the workflow." />
        </div>
      </SectionCard>

      {showInv ? (
        <SectionCard title="Inventory" description="A cleaner snapshot of station-side inventory.">
          {inventory.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)]">No inventory items yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {inventory.map((it) => (
                <div key={it.id} className="rs-surface-muted flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {it.name}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Station supply item
                    </div>
                  </div>
                  <div className="rs-pill">× {it.qty}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Tables"
        description={`Open a table from ${station.stationName} to continue into the existing order flow.`}
      >
        {tables.length === 0 ? (
          <div className="text-sm text-[var(--muted-foreground)]">
            No tables are assigned to this station yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem("lastTableNum", String(t.tableNum));
                    sessionStorage.setItem("lastTableId", t.id);
                  } catch {
                    // ignore
                  }

                  onOpenOrderForTable(t.id);
                }}
                className="group rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-4 text-left transition hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--card)] hover:shadow-[var(--shadow-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <TableIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="rs-pill">Table {t.tableNum}</div>
                </div>

                <div className="mt-6 text-lg font-semibold text-[var(--foreground)]">
                  {t.owner?.trim() ? t.owner : "Walk-in / no guest name"}
                </div>
                <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Open the live order and keep the existing workflow exactly as-is.
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    ₪{formatMoney(t.total ?? 0)}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
                    <OrdersIcon className="h-4 w-4" />
                    Open order
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
