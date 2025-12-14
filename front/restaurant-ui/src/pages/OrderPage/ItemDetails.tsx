// src/pages/Order/ItemDetails.tsx
import React from "react";
import type { ProductItem } from "./OrderPage";

type ItemDetailsProps = {
  product: ProductItem;
  qty: number;
  setQty: (n: number) => void;
  notes: string;
  setNotes: (s: string) => void;
  adds: string[];
  setAdds: (a: string[]) => void;
  onCancel: () => void;
  onAdd: () => void;
};

export default function ItemDetails({
  product, qty, setQty, notes, setNotes, adds, setAdds, onCancel, onAdd,
}: ItemDetailsProps) {
  const toggleAdd = (name: string) =>
    setAdds(adds.includes(name) ? adds.filter((x) => x !== name) : [...adds, name]);

  return (
    <div className="rounded-2xl ring-1 ring-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-lg font-semibold text-gray-800">{product.name}</div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">Qty</span>
        <button
          className="rounded-lg px-2 py-1 ring-1 ring-gray-200 hover:bg-gray-50"
          onClick={() => setQty(Math.max(1, qty - 1))}
        >
          −
        </button>
        <span className="w-8 text-center text-gray-800">{qty}</span>
        <button
          className="rounded-lg px-2 py-1 ring-1 ring-gray-200 hover:bg-gray-50"
          onClick={() => setQty(qty + 1)}
        >
          +
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-sm text-gray-600">Additions</div>
        <div className="flex flex-wrap gap-2">
          {["Extra Ice", "Lemon", "Tonic", "Mint"].map((a) => {
            const active = adds.includes(a);
            return (
              <button
                key={a}
                className={`rounded-xl px-3 py-1 text-sm ring-1 transition ${
                  active ? "ring-gray-800 bg-gray-900 text-white" : "ring-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => toggleAdd(a)}
                aria-pressed={active}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 text-sm text-gray-600">Notes</div>
        <textarea
          className="w-full rounded-xl p-2 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="No sugar, half ice…"
        />
      </div>

      <div className="flex gap-2">
        <button className="rounded-xl px-3 py-2 ring-1 ring-gray-200 hover:bg-gray-50" onClick={onCancel}>
          Cancel
        </button>
        <button className="rounded-xl px-3 py-2 ring-1 ring-gray-800 bg-gray-900 text-white hover:shadow-sm" onClick={onAdd}>
          Add to order
        </button>
      </div>
    </div>
  );
}
