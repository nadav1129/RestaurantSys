// src/pages/Order/OrderItems.tsx
import React from "react";
import type { CartItem } from "./OrderPage";

type OrderItemsProps = {
  cart: CartItem[];
  total: number;
  totalWith10: number;
  only10: number;
  onRemove: (index: number) => void;
  onConfirm: () => Promise<void> | void;
  onPay: () => Promise<void> | void;
  hasConfirmed: boolean;
};

export default function OrderItems({
  cart, total, totalWith10, only10, onRemove, onConfirm, onPay, hasConfirmed,
}: OrderItemsProps) {
  return (
    <div className="rounded-2xl ring-1 ring-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-medium text-gray-700">Items</div>

      {cart.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No items yet.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {cart.map((c, idx) => (
            <li key={`${c.id}-${idx}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-800">
                    {c.qty}× {c.name} {c.price ? `· ₪${c.price}` : ""}
                  </div>
                  {c.additions.length > 0 && (
                    <div className="text-xs text-gray-500">+ {c.additions.join(", ")}</div>
                  )}
                  {c.notes && <div className="text-xs text-gray-500">“{c.notes}”</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.status === "confirmed"
                        ? "bg-green-100 text-green-700 ring-1 ring-green-200"
                        : "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.status === "pending" && (
                    <button
                      className="rounded-xl px-2 py-1 text-sm ring-1 ring-gray-200 hover:bg-gray-50"
                      onClick={() => onRemove(idx)}
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total ₪{total} · Tip ₪{only10} · Pay ₪{totalWith10}
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl px-3 py-2 ring-1 ring-gray-200 hover:bg-gray-50" onClick={onConfirm}>
            Confirm
          </button>
          <button
            className={`rounded-xl px-3 py-2 ring-1 ${
              hasConfirmed
                ? "ring-gray-800 bg-gray-900 text-white hover:shadow-sm"
                : "ring-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            onClick={onPay}
            disabled={!hasConfirmed}
            title={!hasConfirmed ? "Confirm order first" : undefined}
          >
            Pay & Close
          </button>
        </div>
      </div>
    </div>
  );
}
