// src/pages/Order/OrderMenu.tsx
import React from "react";
import type { MenuNode, ProductItem } from "./OrderPage";

type OrderMenuProps = {
  path: MenuNode[];
  current: MenuNode | null;
  products: ProductItem[];
  onPickProduct: (p: ProductItem) => void;
};

export default function OrderMenu({ path, current, products, onPickProduct }: OrderMenuProps) {
  return (
    <div className="rounded-2xl ring-1 ring-gray-200 bg-white p-4 shadow-sm">
      {/* Breadcrumb */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
        {path.map((n, i) => (
          <span key={n.id} className="truncate">
            {i > 0 && <span className="mx-1 text-gray-300">/</span>}
            {n.name}
          </span>
        ))}
      </div>

      {/* Products grid */}
      {current && products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              className="rounded-xl px-3 py-2 text-left ring-1 ring-gray-200 hover:bg-gray-50 hover:shadow-sm transition"
              onClick={() => onPickProduct(p)}
            >
              <div className="font-medium text-gray-800">{p.name}</div>
              <div className="text-xs text-gray-500">
                {p.price != null ? `₪${p.price}` : "n/a"}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">Choose a category on the right to see products.</div>
      )}
    </div>
  );
}
