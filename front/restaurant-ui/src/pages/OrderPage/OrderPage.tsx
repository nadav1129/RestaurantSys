import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/Button";
import { apiFetch } from "../../api/api";
import OrderInfoCard from "./OrderInfoCard";

/* =========================
   Types
========================= */

// UI product model (used at leaf nodes)
type ProductItem = {
  id: string;
  name: string;
  type: string;
  price: number | null; // shekels (mapped from backend cents) or null
};

// UI menu node
type MenuNode = {
  id: string;
  name: string;
  isLeaf?: boolean; // may be unreliable from backend; we also infer via children
  children?: MenuNode[];
  products?: ProductItem[]; // populated when we enter a leaf and fetch products
};

type CartItem = {
  id: string; // product id
  name: string;
  qty: number;
  price: number; /* unit price actually charged */
  additions: string[];
  notes?: string;
};

// Backend DTOs
type SettingsDto = { activeMenuNum: number | null; globalDiscountPct: number };

// This matches your /api/menu-nodes response (children of root)
type ApiNode = {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean; // may not be trustworthy; we still infer from children
  children?: ApiNode[];
};

/* =========================
   Helpers
========================= */

// IMPORTANT: only treat explicit true as leaf.
// If backend sends isLeaf: false for real leaves, we still infer by children.
function isLeaf(node: MenuNode): boolean {
  if (node.isLeaf === true) return true; // explicit true
  if (node.products && node.products.length > 0) return true; // we already have products
  return !node.children || node.children.length === 0; // no children -> leaf
}

// Map ApiNode -> MenuNode (categories only in this endpoint)
function mapCategory(n: ApiNode): MenuNode {
  return {
    id: n.id,
    name: n.name,
    isLeaf: n.isLeaf,
    children: n.children?.map(mapCategory),
  };
}

function arrayEq(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

/* =========================
   Page
========================= */
export default function OrderPage() {
  // “Quick order” table default is none
  const [table, setTable] = useState<string>("none");

  // Reservation / guest fields
  const [guestName, setGuestName] = useState<string>("");
  const [diners, setDiners] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Fixed time fields
  const [startTime] = useState<Date>(() => new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);

  // Order/cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderConfirmed, setOrderConfirmed] = useState<boolean>(false);

  // menu + settings
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [root, setRoot] = useState<MenuNode | null>(null);
  const [path, setPath] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: browsing products vs customizing a product
  const [mode, setMode] = useState<"browse" | "customize">("browse");
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Customization state
  const [customQty, setCustomQty] = useState<number>(1);
  const [customNotes, setCustomNotes] = useState<string>("");
  const [customAdds, setCustomAdds] = useState<string[]>([]);

  // Keep track of which nodeIds we've already fetched products for
  const fetchedNodeIds = useRef<Set<string>>(new Set());

  // Cache of nodeId -> products so re-entering a category restores its products instantly
  const productCacheRef = useRef<Map<string, ProductItem[]>>(new Map());

  // Reset confirmation when cart is cleared
  useEffect(() => {
    if (cart.length === 0) {
      setOrderConfirmed(false);
      setEndTime(null);
    }
  }, [cart.length]);

  // load active settings + selected menu tree (correct endpoint)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) read current settings (active menu + discount)
        const s = (await apiFetch("/api/settings")) as SettingsDto;
        const active = s?.activeMenuNum ?? null;
        const disc = typeof s?.globalDiscountPct === "number" ? s.globalDiscountPct : 0;

        if (active == null) {
          if (!cancelled) {
            setDiscountPct(disc);
            setRoot(null);
            setPath([]);
            setError("No active menu selected. Set it in Management Settings.");
          }
          return;
        }

        // 2) load the tree: backend returns children[] of root
        const arr = (await apiFetch(`/api/menu-nodes?menu=${active}`)) as ApiNode[];

        // Wrap server's children[] into a fake root
        const fakeRoot: MenuNode = {
          id: "root",
          name: "Menu",
          isLeaf: false,
          children: (arr ?? []).map(mapCategory),
        };

        if (!cancelled) {
          setDiscountPct(disc);
          setRoot(fakeRoot);
          setPath([fakeRoot]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load menu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = path[path.length - 1] ?? null;
  const parent = path.length > 1 ? path[path.length - 2] : null;

  useEffect(() => {
    if (!current) return;

    // Only consider nodes that look like leaves (no children or explicitly leaf)
    if (!isLeaf(current)) return;

    // If node already has products on it, we’re done
    if (Array.isArray(current.products)) return;

    // If we’ve fetched before, hydrate from cache and stop
    const cached = productCacheRef.current.get(current.id);
    if (cached) {
      setPath((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.slice();
        const i = next.length - 1;
        next[i] = { ...next[i], products: cached, isLeaf: true };
        return next;
      });
      return;
    }

    (async () => {
      try {
        const arr = (await apiFetch(
          `/api/menu-nodes/${current.id}/products`
        )) as Array<{ id: string; name: string; type: string; price: number | null }>;

        // Map backend cents -> UI shekels (remove /100 if already in shekels)
        const mapped: ProductItem[] = (arr ?? []).map((x) => ({
          id: x.id,
          name: x.name,
          type: x.type,
          price: (x.price ?? 0) / 100,
        }));

        // Cache it
        productCacheRef.current.set(current.id, mapped);

        // 1) Update the node in the current path
        setPath((prev) => {
          if (prev.length === 0) return prev;
          const next = prev.slice();
          const i = next.length - 1;
          next[i] = { ...next[i], products: mapped, isLeaf: true };
          return next;
        });

        // 2) Also update the node inside the tree (so parent.children holds hydrated child)
        setRoot((prev) => {
          if (!prev) return prev;

          const apply = (n: MenuNode): MenuNode => {
            if (n.id === current.id) {
              return { ...n, products: mapped, isLeaf: true };
            }
            if (!n.children || n.children.length === 0) return n;
            let changed = false;
            const children = n.children.map((c) => {
              const cc = apply(c);
              if (cc !== c) changed = true;
              return cc;
            });
            return changed ? { ...n, children } : n;
          };

          return apply(prev);
        });
      } catch {
        // Optionally set an error banner
        // setError("Failed to load products for this category.");
      }
    })();
  }, [current?.id]);

  // If at leaf: show its products (or whenever we have products)
  const currentProducts = useMemo(() => {
    if (!current) return [];
    if (Array.isArray(current.products)) return current.products;
    return isLeaf(current) ? [] : [];
  }, [current]);

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const total = subtotal; // raw total (no service)
  const only10 = Math.round(total * 0.1);
  const totalWith10 = total + only10;
  const minimum = total; // TODO: wire real minimum from settings if/when you have it

  /* -------- Category navigation -------- */
  const enterNode = (node: MenuNode) => setPath((p) => [...p, node]);
  const goUpOne = () => {
    if (path.length > 1) setPath((p) => p.slice(0, p.length - 1));
  };

  /* -------- Product selection / customization -------- */
  const openCustomize = (p: ProductItem) => {
    setSelectedProduct(p);
    setCustomQty(1);
    setCustomNotes("");
    setCustomAdds([]);
    setMode("customize");
  };

  const confirmAddToOrder = () => {
    if (!selectedProduct) return;
    const { id, name } = selectedProduct;
    const unitPrice = selectedProduct.price ?? 0; // guard null
    const additions = customAdds.slice();

    setCart((prev) => {
      const i = prev.findIndex(
        (c) => c.id === id && c.notes === customNotes && arrayEq(c.additions, additions)
      );
      if (i >= 0) {
        const next = prev.slice();
        next[i] = { ...next[i], qty: next[i].qty + customQty };
        return next;
      }
      return [
        ...prev,
        { id, name, qty: customQty, price: unitPrice, additions, notes: customNotes },
      ];
    });

    setMode("browse");
    setSelectedProduct(null);
  };

  const removeCartItem = (index: number) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  const handleTopButtonClick = () => {
    if (cart.length === 0) return;

    if (!orderConfirmed) {
      setOrderConfirmed(true);
      return;
    }

    // Pay now
    const now = new Date();
    setEndTime(now);
    alert(
      `Pay ₪${totalWith10} for table ${table} (Total: ₪${total}, Tip (10%): ₪${only10})`
    );
  };

  /* =========================
     Render
  ========================= */
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Top info card */}
      <OrderInfoCard
        table={table}
        setTable={setTable}
        guestName={guestName}
        setGuestName={setGuestName}
        diners={diners}
        setDiners={setDiners}
        phone={phone}
        setPhone={setPhone}
        note={note}
        setNote={setNote}
        startTime={startTime}
        endTime={endTime}
        minimum={minimum}
        total={total}
        totalWith10={totalWith10}
        only10={only10}
        orderConfirmed={orderConfirmed}
        onTopButtonClick={handleTopButtonClick}
        hasItems={cart.length > 0}
      />

      {/* Main layout: Order list (left) + Content (center) + Category (right) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,1fr)_minmax(420px,2fr)_minmax(260px,1fr)]">
        {/* Left: current order list */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Order Items</div>
            <Button
              variant={orderConfirmed ? "secondary" : "primary"}
              className="text-xs"
              disabled={cart.length === 0 || orderConfirmed}
              onClick={() => {
                if (cart.length === 0) return;
                setOrderConfirmed(true);
              }}
            >
              {orderConfirmed ? "Confirmed" : "Confirm"}
            </Button>
          </div>
          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No items yet.</div>
          ) : (
            <ul className="space-y-3">
              {cart.map((c, idx) => (
                <li key={`${c.id}-${idx}`} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {c.name} × {c.qty}
                      </div>
                      <div className="text-xs text-gray-500">
                        ₪{c.price} each · Subtotal ₪{c.qty * c.price}
                      </div>
                      {(c.additions.length > 0 || c.notes) && (
                        <div className="mt-1 text-xs text-gray-600">
                          {c.additions.length > 0 && <div>+ {c.additions.join(", ")}</div>}
                          {c.notes && <div>“{c.notes}”</div>}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => removeCartItem(idx)}
                      className="text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Center: main content area */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          {loading && <div className="text-sm text-gray-500">Loading menu…</div>}
          {!loading && error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && root && (
            <>
              {mode === "browse" && (
                <>
                  {current ? (
                    <>
                      <div className="mb-3 text-sm font-semibold">
                        {current.name} — Products
                        {discountPct > 0 && (
                          <span className="ml-2 text-xs font-normal text-green-700">
                            ({discountPct}% off applied)
                          </span>
                        )}
                      </div>
                      <ProductGrid products={currentProducts} onPick={openCustomize} />
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">Pick a category on the right.</div>
                  )}
                </>
              )}

              {mode === "customize" && selectedProduct && (
                <CustomizeProduct
                  product={selectedProduct}
                  qty={customQty}
                  setQty={setCustomQty}
                  notes={customNotes}
                  setNotes={setCustomNotes}
                  adds={customAdds}
                  toggleAdd={(a) =>
                    setCustomAdds((prev) =>
                      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                    )
                  }
                  onCancel={() => {
                    setMode("browse");
                    setSelectedProduct(null);
                  }}
                  onConfirm={confirmAddToOrder}
                />
              )}
            </>
          )}
        </div>

        {/* Right: Category sidebar with recursive nav */}
        <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
            {current?.name ?? "Menu"}
          </div>

          <div className="p-2">
            {loading ? (
              <div className="text-xs text-gray-500">Loading…</div>
            ) : !root ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                No menu loaded.
              </div>
            ) : current && (current.children?.length ?? 0) > 0 ? (
              <ul className="space-y-2">
                {(current.children ?? []).map((child) => (
                  <li key={child.id}>
                    <button
                      onClick={() => enterNode(child)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-gray-300 hover:bg-gray-50"
                    >
                      {child.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                This is a leaf. Products appear in the main area.
              </div>
            )}
          </div>

          {parent && (
            <button
              onClick={() => goUpOne()}
              className="m-2 w-[calc(100%-1rem)] rounded-xl bg-indigo-600 px-4 py-2 text-left text-sm font-medium text-white hover:bg-indigo-700"
              title="Go up"
              aria-label="Go up to parent"
            >
              ↑ {parent.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Local helpers: ProductGrid & CustomizeProduct
========================= */

function ProductGrid({
  products,
  onPick,
}: {
  products: ProductItem[];
  onPick: (p: ProductItem) => void;
}) {
  if (!products || products.length === 0) {
    return <div className="text-sm text-gray-500">No products in this category.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          className="rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-gray-300 hover:bg-gray-50"
        >
          <div className="text-sm font-medium text-gray-800">{p.name}</div>
          <div className="text-xs text-gray-500">₪{p.price ?? 0}</div>
        </button>
      ))}
    </div>
  );
}

function CustomizeProduct({
  product,
  qty,
  setQty,
  notes,
  setNotes,
  adds,
  toggleAdd,
  onCancel,
  onConfirm,
}: {
  product: ProductItem;
  qty: number;
  setQty: (n: number) => void;
  notes: string;
  setNotes: (s: string) => void;
  adds: string[];
  toggleAdd: (a: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Placeholder until additions are provided by backend
  const addOptions: string[] = [];

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold">{product.name}</div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-700">Qty</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="text-sm text-gray-700">
          Unit price: <span className="font-medium">₪{product.price ?? 0}</span>
        </div>
        <div className="text-sm text-gray-700">
          Line total: <span className="font-semibold">₪{(product.price ?? 0) * qty}</span>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-gray-700">Additions</div>
        {addOptions.length === 0 ? (
          <div className="text-xs text-gray-500">No additions for this product.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {addOptions.map((a: string) => {
              const selected = adds.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAdd(a)}
                  className={`rounded-xl border px-3 py-1 text-xs ${
                    selected
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selected ? "✓ " : ""}
                  {a}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-gray-700">Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-gray-300 p-2 text-sm"
          rows={3}
          placeholder="No ice, extra lemon…"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
        >
          Add to Order
        </button>
      </div>
    </div>
  );
}
