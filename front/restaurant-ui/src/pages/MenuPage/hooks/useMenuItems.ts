// src/pages/MenuPage/hooks/useMenuItems.ts
import { useEffect, useState } from "react";
import { apiFetch } from "../../../api/api";

export type MenuItemRow = {
  menuItemId: string;
  productId: string;
  productName: string;
  price: number | null;  /* in normal currency units, e.g. 10 = ₪10 */
  _dirty?: boolean;
  _new?: boolean;
};

export default function useMenuItems(
  selectedMenu: number | null,
  selectedNodeId: string | null
) {
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  /* ---------------- Load existing menu items (pricing table) ---------------- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingItems(true);
      try {
        if (!selectedNodeId) {
          setMenuItems([]);
          return;
        }

        const res = await apiFetch(`/api/menu-nodes/${selectedNodeId}/products`);
        if (cancelled) return;

        const rows: MenuItemRow[] = (Array.isArray(res) ? res : []).map((r: any) => {
          const productId = r.productId ?? r.product_id ?? r.id;
          const cents = r.price ?? null; // backend already uses 'price' in cents
          return {
            menuItemId: `${selectedNodeId}:${productId}`,
            productId,
            productName: r.productName ?? r.name,
            price: cents == null ? null : cents / 100, // convert to normal units
            _dirty: false,
            _new: false,
          };
        });

        setMenuItems(rows);
      } catch (e) {
        console.error(`GET /api/menu-nodes/${selectedNodeId}/products failed`, e);
        setMenuItems([]);
      } finally {
        setIsLoadingItems(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  /* ---------------- Drag and Drop helpers ---------------- */
  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDropIntoPricing(e: React.DragEvent) {
    e.preventDefault();
    const productId = e.dataTransfer.getData("product-id");
    const productName = e.dataTransfer.getData("product-name") || "(product)";
    const priceRaw = e.dataTransfer.getData("product-price");
    const defaultPrice = priceRaw ? Number(priceRaw) : 0;

    if (!productId) return;

    // Stage a NEW unsaved row
    setMenuItems((rows) => [
      ...rows,
      {
        menuItemId: "",
        productId,
        productName,
        price: defaultPrice,
        _dirty: true,
        _new: true,
      },
    ]);
  }

  /* ---------------- Save Row ---------------- */
  async function saveRow(row: MenuItemRow) {
    if (!selectedNodeId) return;
    if (!selectedMenu || selectedMenu <= 0) {
      console.warn("No menu selected; cannot upsert price.");
      alert("Please select a menu before saving price.");
      return;
    }
    if (
      !row.productId ||
      row.productId === "00000000-0000-0000-0000-000000000000"
    ) {
      console.error("saveRow: missing/zero productId", row);
      alert("Internal error: productId is missing.");
      return;
    }

    // Convert displayed price (number) → integer cents
    const price =
      row.price == null ? null : Math.round(row.price * 100);

    try {
      if (row._new) {
        // 1) link product -> node
        await apiFetch(`/api/menu-nodes/${selectedNodeId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: row.productId }),
        });
      }

      // 2) upsert price (only 'price', no priceCents)
      await apiFetch(`/api/product-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          menuNum: selectedMenu,
          price, // integer cents
        }),
      });

      // 3) clear flags locally
      setMenuItems((rows) =>
        rows.map((r) =>
          r === row
            ? {
                ...r,
                _dirty: false,
                _new: false,
                menuItemId:
                  r.menuItemId ?? `${selectedNodeId}:${row.productId}`,
              }
            : r
        )
      );
    } catch (e) {
      console.error("saveRow failed", e);
      alert("Saving price failed. Check console for details.");
    }
  }

  /* ---------------- Remove Row ---------------- */
  async function removeRow(row: MenuItemRow) {
    if (row._new) {
      setMenuItems((rows) => rows.filter((r) => r !== row));
      return;
    }
    if (!selectedNodeId) return;

    try {
      await apiFetch(`/api/menu-nodes/${selectedNodeId}/products/${row.productId}`, {
        method: "DELETE",
      });
      setMenuItems((rows) => rows.filter((r) => r !== row));
    } catch (e) {
      console.error("DELETE link failed", e);
    }
  }

  /* ---------------- Return API ---------------- */
  return {
    menuItems,
    isLoadingItems,
    setMenuItems,
    allowDrop,
    handleDropIntoPricing,
    saveRow,
    removeRow,
  };
}
