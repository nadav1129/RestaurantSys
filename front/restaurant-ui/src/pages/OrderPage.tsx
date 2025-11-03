// File: src/pages/OrderPage.tsx
import React, { useMemo, useState } from "react";
import Button from "../components/Button";

/* =========================
   Types
========================= */
type Product = {
  id: string;
  name: string;
  price: number;
  additions?: string[]; // optional add-ons (e.g., “XL”, “Lemon”, “Double”)
};

type MenuNode = {
  id: string;
  name: string;
  children?: MenuNode[]; // non-leaf
  products?: Product[];  // leaf (if present, treat as leaf)
};

type CartItem = {
  id: string; // product id
  name: string;
  qty: number;
  price: number;
  additions: string[];
  notes?: string;
};

/* =========================
   Mock data (replace via API later)
========================= */
const menuTree: MenuNode = {
  id: "root",
  name: "Menu",
  children: [
    {
      id: "wine",
      name: "Wine",
      children: [
        {
          id: "white",
          name: "White",
          products: [
            { id: "p_w_chard", name: "Chardonnay (Glass)", price: 36, additions: ["XL", "Lemon"] },
            { id: "p_w_sauv", name: "Sauvignon Blanc (Glass)", price: 34, additions: ["XL", "Lemon"] },
            { id: "p_w_bottle", name: "House White (Bottle)", price: 140, additions: ["Chiller", "2 Ice Buckets"] },
          ],
        },
        {
          id: "red",
          name: "Red",
          products: [
            { id: "p_r_merlot", name: "Merlot (Glass)", price: 36, additions: ["XL"] },
            { id: "p_r_cab", name: "Cabernet (Glass)", price: 38, additions: ["XL"] },
            { id: "p_r_bottle", name: "House Red (Bottle)", price: 150, additions: ["Chiller", "2 Ice Buckets"] },
          ],
        },
      ],
    },
    {
      id: "soft",
      name: "Soft Drinks",
      products: [
        { id: "p_cola", name: "Cola", price: 12, additions: ["Ice", "Lemon"] },
        { id: "p_soda", name: "Soda", price: 10, additions: ["Ice"] },
        { id: "p_orange", name: "Orange Juice", price: 16, additions: ["Ice"] },
      ],
    },
    {
      id: "shots",
      name: "Shots",
      children: [
        {
          id: "vodka",
          name: "Vodka",
          products: [
            { id: "p_v_plain", name: "Vodka Shot", price: 18, additions: ["XL", "Lemon", "Ice"] },
            { id: "p_v_premium", name: "Premium Vodka Shot", price: 24, additions: ["XL", "Lemon", "Ice"] },
          ],
        },
        {
          id: "tequila",
          name: "Tequila",
          products: [
            { id: "p_t_plain", name: "Tequila Shot", price: 20, additions: ["Salt", "Lemon"] },
            { id: "p_t_premium", name: "Premium Tequila Shot", price: 28, additions: ["Salt", "Lemon"] },
          ],
        },
      ],
    },
  ],
};

/* =========================
   Helpers
========================= */
function isLeaf(node: MenuNode): boolean {
  return !!node.products && (!node.children || node.children.length === 0);
}

function getChildren(node: MenuNode): MenuNode[] {
  return node.children ?? [];
}

/* =========================
   Page
========================= */
export default function OrderPage() {
  // “Quick order” table default is none (as requested)
  const [table, setTable] = useState<string>("none");

  // Order/cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Menu navigation stack: path from root → current
  // Start at root but render its children initially
  const [path, setPath] = useState<MenuNode[]>([menuTree]);

  // View mode: browsing products vs customizing a product
  const [mode, setMode] = useState<"browse" | "customize">("browse");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Customization state
  const [customQty, setCustomQty] = useState<number>(1);
  const [customNotes, setCustomNotes] = useState<string>("");
  const [customAdds, setCustomAdds] = useState<string[]>([]);

  const current = path[path.length - 1];
  const parent = path.length > 1 ? path[path.length - 2] : null;

  // If at leaf: show its products, else show child categories in sidebar
  const currentProducts = useMemo(() => (isLeaf(current) ? current.products ?? [] : []), [current]);

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const service = Math.round(subtotal * 0.1);
  const total = subtotal + service;

  /* -------- Category navigation -------- */
  const enterNode = (node: MenuNode) => {
    setPath((p) => [...p, node]);
    // If leaf, switch main area to products (mode stays browse)
  };

  const goUpOne = () => {
    if (path.length > 1) {
      setPath((p) => p.slice(0, p.length - 1));
    }
  };

  /* -------- Product selection / customization -------- */
  const openCustomize = (p: Product) => {
    setSelectedProduct(p);
    setCustomQty(1);
    setCustomNotes("");
    setCustomAdds([]);
    setMode("customize");
  };

  const toggleAddition = (add: string) => {
    setCustomAdds((prev) =>
      prev.includes(add) ? prev.filter((a) => a !== add) : [...prev, add]
    );
  };

  const confirmAddToOrder = () => {
    if (!selectedProduct) return;
    const { id, name, price } = selectedProduct;
    const additions = customAdds.slice();

    setCart((prev) => {
      // Merge line if same product *and* same additions and notes (simple strategy)
      const i = prev.findIndex(
        (c) => c.id === id && c.notes === customNotes && arrayEq(c.additions, additions)
      );
      if (i >= 0) {
        const next = prev.slice();
        next[i] = { ...next[i], qty: next[i].qty + customQty };
        return next;
      }
      return [...prev, { id, name, qty: customQty, price, additions, notes: customNotes }];
    });

    // Back to browsing
    setMode("browse");
    setSelectedProduct(null);
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  /* =========================
     Render
  ========================= */
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Top panel: table + totals */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">Table</div>
          <input
            className="w-28 rounded-xl border border-gray-300 px-3 py-2 text-sm"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="none"
          />
          <div className="ml-4 text-xs text-gray-500">
            (Leave as <b>none</b> for Quick Order)
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Subtotal: </span>
            <span className="font-medium">₪{subtotal}</span>
          </div>
          <div>
            <span className="text-gray-500">Service (10%): </span>
            <span className="font-medium">₪{service}</span>
          </div>
          <div className="text-base">
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold">₪{total}</span>
          </div>
          <Button onClick={() => alert(`Send order for table ${table} (₪${total})`)}>
            Confirm Order
          </Button>
        </div>
      </div>

      {/* Main layout: Order list (left) + Content (center) + Category (right) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,1fr)_minmax(420px,2fr)_minmax(260px,1fr)]">
        {/* Left: current order list */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold">Order Items</div>
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
                          {c.additions.length > 0 && (
                            <div>+ {c.additions.join(", ")}</div>
                          )}
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
          {mode === "browse" && (
            <>
              {isLeaf(current) ? (
                <>
                  <div className="mb-3 text-sm font-semibold">
                    {current.name} — Products
                  </div>
                  <ProductGrid products={currentProducts} onPick={openCustomize} />
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Pick a category on the right. (Nothing selected yet.)
                </div>
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
              toggleAdd={toggleAddition}
              onCancel={() => {
                setMode("browse");
                setSelectedProduct(null);
              }}
              onConfirm={confirmAddToOrder}
            />
          )}
        </div>

        {/* Right: Category sidebar with recursive nav */}
        <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-hidden">
          {/* Parent header (colored) when not at root */}
          {parent ? (
            <button
              onClick={goUpOne}
              className="flex w-full items-center justify-between bg-indigo-600 px-4 py-3 text-left text-sm font-medium text-white hover:bg-indigo-700"
              title="Go up"
              aria-label="Go up to parent"
            >
              <span>{parent.name}</span>
              {/* up chevron */}
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
              </svg>
            </button>
          ) : (
            <div className="bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
              {current.name}
            </div>
          )}

          {/* Body: if non-leaf, show children; if leaf, show message */}
          <div className="p-2">
            {!isLeaf(current) ? (
              <ul className="space-y-2">
                {getChildren(current).map((child) => (
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
                This is a leaf. Products are shown in the main area.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Subcomponents
========================= */

function ProductGrid({
  products,
  onPick,
}: {
  products: Product[];
  onPick: (p: Product) => void;
}) {
  if (products.length === 0) {
    return <div className="text-sm text-gray-400">No products.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          className="rounded-2xl border border-gray-200 bg-white p-3 text-left hover:border-gray-300 hover:bg-gray-50"
        >
          <div className="text-sm font-medium">{p.name}</div>
          <div className="text-xs text-gray-500">₪{p.price}</div>
          {p.additions && p.additions.length > 0 && (
            <div className="mt-1 text-[11px] text-gray-400">
              Additions: {p.additions.join(", ")}
            </div>
          )}
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
  product: Product;
  qty: number;
  setQty: (n: number) => void;
  notes: string;
  setNotes: (s: string) => void;
  adds: string[];
  toggleAdd: (a: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <div className="mb-4 text-lg font-semibold">{product.name}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <label className="block text-sm text-gray-700">Quantity</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="w-24 rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="text-sm text-gray-500">x ₪{product.price} = ₪{product.price * qty}</div>
          </div>

          <label className="block pt-2 text-sm text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-24 w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm"
            placeholder="Special requests..."
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-700">Additions</div>
          {product.additions && product.additions.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {product.additions.map((a) => {
                const on = adds.includes(a);
                return (
                  <li key={a}>
                    <button
                      type="button"
                      onClick={() => toggleAdd(a)}
                      className={[
                        "w-full rounded-xl border px-3 py-2",
                        on
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {a}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-xs text-gray-400">No additions for this product.</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={onConfirm}>Add to Order</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* =========================
   Utils
========================= */
function arrayEq(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}
