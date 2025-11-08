import React from "react";
import type { MenuItemRow } from "../hooks/useMenuItems";

export default function MenuPricingPanel({
  menuName,
  sectionLabel, // e.g., selectedNode ? `Section: ${selectedNode.name}` : "Root"
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
    <div
      className="mt-4 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4"
      onDragOver={allowDrop}
      onDrop={handleDropIntoPricing}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-gray-600">Menu & Pricing</div>
          <div className="text-lg font-semibold text-gray-900">
            {menuName || "—"}
            <span className="ml-2 text-sm font-normal text-gray-600">
              • {sectionLabel}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Tip: drag products from the left panel and drop here to stage them, then set a price and Save.
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="w-8 px-3 py-2">#</th>
              <th className="px-3 py-2">Product</th>
              <th className="w-40 px-3 py-2">Price (₪)</th>
              <th className="w-40 px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingItems ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : menuItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                  Drag products here to start building your menu.
                </td>
              </tr>
            ) : (
              menuItems.map((row, idx) => (
                <tr
                  key={(row.menuItemId || row.productId) + ":" + idx}
                  className="border-t border-gray-100 text-sm"
                >
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="truncate px-3 py-2 font-medium text-gray-800">
                    {row.productName}
                    {row._new && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        NEW
                      </span>
                    )}
                    {row._dirty && !row._new && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                        Edited
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={row.price ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const next = raw === "" ? null : Number(raw);  // <-- back to number|null
                      setMenuItems((rs) =>
                      rs.map((r) => (r === row ? { ...r, price: next, _dirty: true } : r))
                       );
                      }}
                   className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRow(row)}
                        disabled={!row._dirty}
                        className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => removeRow(row)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Current target for new items: <span className="font-semibold">{sectionLabel}</span>.
      </div>
    </div>
  );
}
