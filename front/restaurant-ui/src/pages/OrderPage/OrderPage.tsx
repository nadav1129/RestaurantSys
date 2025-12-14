// src/pages/OrderPage/OrderPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../api/api";
import OrderInfoCard from "./OrderInfoCard";
import OrderMenu from "./OrderMenu";
import ItemDetails from "./ItemDetails";
import OrderItems from "./OrderItems";

/* ===== Types ===== */
export type ProductItem = {
  id: string;
  name: string;
  type: string;
  price: number | null; // ₪
};

export type MenuNode = {
  id: string;
  name: string;
  isLeaf?: boolean;
  children?: MenuNode[];
  products?: ProductItem[];
};

export type CartItem = {
  id: string;
  name: string;
  qty: number;
  price: number; // unit price ₪
  additions: string[];
  notes?: string;
  status: "pending" | "confirmed";
};

type ShiftDto = { shiftId: string; openedAt: string };
type SettingsDto = {
  activeMenuNum: number | null;
  globalDiscountPct?: number | null;
};

type OrderPageProps = {
  initialTableNum?: string | null;
  initialTableId?: string | null;
};

export default function OrderPage({
  initialTableNum = null,
  initialTableId = null,
}: OrderPageProps) {
  /* Header fields */
  const [table, setTable] = useState<string>("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [diners, setDiners] = useState("");
  const [note, setNote] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);

  /* Shift + settings */
  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [settings, setSettings] = useState<SettingsDto | null>(null);

  /* Menu path */
  const [path, setPath] = useState<MenuNode[]>([]);
  const current = path[path.length - 1] ?? null;

  /* Products cache */
  const productCacheRef = useRef<Map<string, ProductItem[]>>(new Map());

  /* Cart / order */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);

  /* UI mode */
  const [mode, setMode] = useState<"browse" | "details">("browse");
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null
  );

  /* Customization for ItemDetails */
  const [customQty, setCustomQty] = useState<number>(1);
  const [customNotes, setCustomNotes] = useState<string>("");
  const [customAdds, setCustomAdds] = useState<string[]>([]);

  /* Totals */
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const total = subtotal;
  const only10 = Math.round(total * 0.1);
  const totalWith10 = total + only10;
  const minimum = total;

  /* ===== Init from parent ===== */
  useEffect(() => {
    // Prefer prop; otherwise fall back to the last click we saved
    if (initialTableNum != null && initialTableNum !== "") {
      setTable(String(initialTableNum));
    } else {
      try {
        const t = sessionStorage.getItem("lastTableNum");
        if (t && t !== "") setTable(t);
      } catch {
        /* ignore */
      }
    }
    if (initialTableId != null) setTableId(initialTableId);
  }, [initialTableNum, initialTableId]);

  /* ===== Load shift & settings ===== */
  useEffect(() => {
    (async () => {
      try {
        const s = await apiFetch<ShiftDto | null>("/api/shifts/active");
        setActiveShift(s ?? null);
      } catch (e) {
        console.error("Active shift load failed", e);
      }
    })();

    (async () => {
      try {
        const set = await apiFetch<SettingsDto | null>("/api/settings");
        setSettings(set ?? null);
      } catch (e) {
        console.error("Settings load failed", e);
      }
    })();
  }, []);

  /* ===== Load top-level menu (fake root) ===== */
  useEffect(() => {
    (async () => {
      try {
        const active = settings?.activeMenuNum ?? null;
        if (active == null) return;

        const children = await apiFetch<any[]>(
          `/api/menu-nodes?menu=${active}`
        );

        const mapCategory = (n: any): MenuNode => ({
          id: n.id,
          name: n.name,
          isLeaf: !!n.isLeaf,
          children: (n.children ?? []).map(mapCategory),
        });

        const fakeRoot: MenuNode = {
          id: "root",
          name: "Menu",
          isLeaf: false,
          children: (children ?? []).map(mapCategory),
        };

        setPath([fakeRoot]);
      } catch (e) {
        console.error("Menu categories load failed", e);
      }
    })();
  }, [settings?.activeMenuNum]);

  /* ===== Fetch products when at a leaf ===== */
  useEffect(() => {
    if (!current) return;

    const looksLeaf =
      current.isLeaf === true ||
      !current.children ||
      current.children.length === 0;

    if (!looksLeaf) return;

    // already have products?
    if (Array.isArray(current.products)) return;

    // cached?
    const cached = productCacheRef.current.get(current.id);
    if (cached) {
      setPath((prev) => {
        const next = prev.slice();
        next[next.length - 1] = { ...current, products: cached, isLeaf: true };
        return next;
      });
      return;
    }

    (async () => {
      try {
        const arr = await apiFetch<ProductItem[]>(
          `/api/menu-nodes/${current.id}/products`
        );
        productCacheRef.current.set(current.id, arr ?? []);
        setPath((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            ...current,
            products: arr ?? [],
            isLeaf: true,
          };
          return next;
        });
      } catch (e) {
        console.error("Products load failed for", current.id, e);
      }
    })();
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== Derived ===== */
  const products = useMemo<ProductItem[]>(
    () => current?.products ?? [],
    [current?.products]
  );

  /* ===== Navigation handlers ===== */
  const enterNode = (node: MenuNode) => setPath((p) => [...p, node]);
  const goUpOne = () => {
    if (path.length > 1) setPath((p) => p.slice(0, p.length - 1));
  };

  /* ===== Product selection ===== */
  const onPickProduct = (p: ProductItem) => {
    setSelectedProduct(p);
    setCustomQty(1);
    setCustomNotes("");
    setCustomAdds([]);
    setMode("details");
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const unit = selectedProduct.price ?? 0;
    setCart((prev) => [
      ...prev,
      {
        id: selectedProduct.id,
        name: selectedProduct.name,
        qty: customQty,
        price: unit,
        additions: customAdds.slice(),
        notes: customNotes || undefined,
        status: "pending",
      },
    ]);
    setMode("browse");
    setSelectedProduct(null);
  };

  const removeCartItem = (index: number) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  /* ===== Confirm / Pay ===== */
  const confirmOrder = async () => {
    if (!activeShift?.shiftId) {
      alert("No active shift.");
      return;
    }
    const pending = cart.filter((x) => x.status !== "confirmed");
    if (!pending.length) {
      alert("No items to confirm.");
      return;
    }
    try {
      const body = {
        shiftId: activeShift.shiftId,
        tableNum: table !== "none" ? table : null, // you pass table number
        tableId,
        orderId: orderId ?? null,
        items: pending.map((x) => ({
          productId: x.id,
          qty: x.qty,
          notes: x.notes ?? "",
          additions: x.additions,
        })),
        guestName: guestName || null,
        phone: phone || null,
        diners: diners ? Number(diners) : null,
        note: note || null,
      };
      const res = await apiFetch<{ orderId: string }>("/api/orders/confirm", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOrderId(res.orderId);
      setCart((prev) => prev.map((x) => ({ ...x, status: "confirmed" })));
    } catch (e) {
      console.error("Confirm failed", e);
      alert("Confirm failed");
    }
  };

  const payAndClose = async () => {
    if (!orderId) {
      alert("Confirm the order first.");
      return;
    }
    setEndTime(new Date());
    alert(`Paid ₪${totalWith10} (Total ₪${total}, Tip ₪${only10})`);
    // reset
    setCart([]);
    setOrderId(null);
    setGuestName("");
    setPhone("");
    setDiners("");
    setNote("");
  };

  /* ===== RIGHT sidebar (categories) ===== */
  function CategorySidebar() {
    if (!path.length) {
      return (
        <div className="rounded-2xl ring-1 ring-gray-200 bg-white p-4 shadow-sm text-sm text-gray-500">
          No menu.
        </div>
      );
    }
    const node = current!;
    const children = node?.children ?? [];
    return (
      <div className="rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
          {node?.name ?? "Menu"}
        </div>
        <div className="p-3">
          {children.length === 0 ? (
            <div className="text-xs text-gray-500">No sub-categories.</div>
          ) : (
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id}>
                  <button
                    className="w-full rounded-xl px-3 py-2 text-left ring-1 ring-transparent hover:ring-gray-200 hover:bg-gray-50 transition"
                    onClick={() => enterNode(c)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {path.length > 1 && (
            <button
              className="mt-3 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-gray-200 hover:bg-gray-50 transition"
              onClick={goUpOne}
            >
              ← Up one
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ===== Render (Left items | Center content | Right categories) ===== */
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <OrderInfoCard
        table={table}
        setTable={setTable}
        tableId={tableId}
        setTableId={setTableId}
        guestName={guestName}
        setGuestName={setGuestName}
        diners={diners}
        setDiners={setDiners}
        phone={phone}
        setPhone={setPhone}
        note={note}
        setNote={setNote}
        /* If OrderInfoCard expects Date (not nullable), coerce here */
        startTime={startTime ?? new Date()}
        endTime={endTime}
        minimum={minimum}
        total={total}
        totalWith10={totalWith10}
        only10={only10}
        onTopButtonClick={payAndClose}
        hasItems={cart.some((x) => x.status === "confirmed")}
      />

      {/* EXACT column structure: left | center | right */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(280px,1fr)_minmax(500px,2fr)_minmax(280px,1fr)]">
        {/* LEFT: Order items */}
        <OrderItems
          cart={cart}
          total={total}
          totalWith10={totalWith10}
          only10={only10}
          onRemove={removeCartItem}
          onConfirm={confirmOrder}
          onPay={payAndClose}
          hasConfirmed={cart.some((c) => c.status === "confirmed")}
        />

        {/* CENTER: either product grid or item details */}
        {mode === "details" && selectedProduct ? (
          <ItemDetails
            product={selectedProduct}
            qty={customQty}
            setQty={setCustomQty}
            notes={customNotes}
            setNotes={setCustomNotes}
            adds={customAdds}
            setAdds={setCustomAdds}
            onCancel={() => {
              setMode("browse");
              setSelectedProduct(null);
            }}
            onAdd={addToCart}
          />
        ) : (
          <OrderMenu
            path={path}
            current={current}
            products={products}
            onPickProduct={onPickProduct}
          />
        )}

        {/* RIGHT: Category sidebar */}
        <CategorySidebar />
      </div>
    </div>
  );
}
