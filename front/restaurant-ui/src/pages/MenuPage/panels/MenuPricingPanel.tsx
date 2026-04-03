import type React from "react";
import Button from "../../../components/Button";
import { GripIcon, MenuIcon } from "../../../components/icons";
import { EmptyState, SectionCard } from "../../../components/ui/layout";
import type { MenuItemRow } from "../hooks/useMenuItems";

export default function MenuPricingPanel({
  menuName,
  sectionLabel,
  menuItems,
  isLoadingItems,
  setMenuItems,
  allowDrop,
  handleDropIntoPricing,
  saveRow,
  removeRow,
}: {
  menuName: string;
  sectionLabel: string;
  menuItems: MenuItemRow[];
  isLoadingItems: boolean;
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItemRow[]>>;
  allowDrop: (e: React.DragEvent) => void;
  handleDropIntoPricing: (e: React.DragEvent) => void;
  saveRow: (row: MenuItemRow) => Promise<void>;
  removeRow: (row: MenuItemRow) => Promise<void> | void;
}) {
  return (
    <SectionCard
      title="Menu & Pricing"
      description="Drop products here, adjust pricing, and save changes without leaving the current menu context."
    >
      <div
        className="space-y-4 rounded-[30px] border-2 border-dashed border-[var(--border-strong)] bg-[var(--card-muted)] p-4"
        onDragOver={allowDrop}
        onDrop={handleDropIntoPricing}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {menuName || "—"}
            </div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">
              {sectionLabel}
            </div>
          </div>
          <div className="rs-pill">
            <MenuIcon className="h-4 w-4" />
            Drag products into this area
          </div>
        </div>

        <div className="overflow-x-auto rounded-[26px] border border-[var(--border)] bg-[var(--card)]">
          {isLoadingItems ? (
            <div className="p-6 text-sm text-[var(--muted-foreground)]">
              Loading menu items...
            </div>
          ) : menuItems.length === 0 ? (
            <EmptyState
              title="No items in this section yet"
              description="Drag products from the search list above to stage them here, then set pricing and save."
              className="m-4"
            />
          ) : (
            <table className="rs-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map((row, idx) => (
                  <tr key={(row.menuItemId || row.productId) + ":" + idx}>
                    <td className="text-[var(--muted-foreground)]">
                      <div className="flex items-center gap-2">
                        <GripIcon className="h-4 w-4" />
                        {idx + 1}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-[var(--foreground)]">
                        {row.productName}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {row._new ? (
                          <span className="rs-pill">New</span>
                        ) : null}
                        {row._dirty && !row._new ? (
                          <span className="rs-pill">Edited</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={row.price ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = raw === "" ? null : Number(raw);
                          setMenuItems((rs) =>
                            rs.map((r) =>
                              r === row ? { ...r, price: next, _dirty: true } : r
                            )
                          );
                        }}
                        className="rs-input max-w-[130px]"
                      />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => saveRow(row)} disabled={!row._dirty}>
                          Save
                        </Button>
                        <Button variant="secondary" onClick={() => removeRow(row)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="text-xs text-[var(--muted-foreground)]">
          Current target for new items: <span className="font-semibold text-[var(--foreground)]">{sectionLabel}</span>.
        </div>
      </div>
    </SectionCard>
  );
}
