import { useState } from "react";
import Button from "../components/Button";
import { LightningIcon, OrdersIcon, TableIcon } from "../components/icons";
import { PageContainer, SectionCard, StatCard } from "../components/ui/layout";
import { PosMetricCircle, PosStatusPill } from "../components/ui/pos";
import type { InventoryItem, Station, TableInfo } from "../types";
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
        contentClassName="pt-4 lg:pt-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onOpenOrderForTable("none")}
              className="bg-[var(--highlight)] text-[var(--accent-foreground)]"
            >
              <LightningIcon className="h-4 w-4" />
              Quick Order
            </Button>
            <Button variant="secondary" onClick={() => setShowInv((value) => !value)}>
              {showInv ? "Hide Inventory" : "Show Inventory"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex justify-center xl:justify-start">
            <PosMetricCircle label="Tables" value={tables.length} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Tables"
              value={tables.length}
              hint="Available service points in this station."
            />
            <StatCard
              label="Inventory Items"
              value={inventory.length}
              hint="Quick view of what this station keeps on hand."
            />
            <StatCard
              label="Order Flow"
              value="Live"
              hint="Open a table card below to continue the workflow."
            />
          </div>
        </div>
      </SectionCard>

      {showInv ? (
        <SectionCard
          title="Inventory"
          contentClassName="pt-4 lg:pt-4"
        >
          {inventory.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)]">No inventory items yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="rs-surface-muted flex items-center justify-between p-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {item.name}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Station supply item
                    </div>
                  </div>
                  <PosStatusPill>× {item.qty}</PosStatusPill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Tables"
        contentClassName="pt-4 lg:pt-4"
        actions={
          <Button variant="secondary">
            Map
          </Button>
        }
      >
        {tables.length === 0 ? (
          <div className="text-sm text-[var(--muted-foreground)]">
            No tables are assigned to this station yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem("lastTableNum", String(table.tableNum));
                    sessionStorage.setItem("lastTableId", table.id);
                  } catch {
                    // ignore
                  }

                  onOpenOrderForTable(table.id);
                }}
                className="group rounded-[1.1rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),var(--card-muted))] p-4 text-left transition hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--highlight)] text-[var(--accent-foreground)]">
                    <TableIcon className="h-4.5 w-4.5" />
                  </div>
                  <PosStatusPill>Table {table.tableNum}</PosStatusPill>
                </div>

                <div className="mt-6 text-lg font-semibold text-[var(--foreground)]">
                  {table.owner?.trim() ? table.owner : "Walk-in / no guest name"}
                </div>
                <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Open the live order and keep the current workflow exactly as-is.
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    ₪{formatMoney(table.total ?? 0)}
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
