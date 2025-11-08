import React from "react";

export interface Product {
  id?: string;
  productId?: string;
  name: string;
  price?: number;
}


export default function ProductCatalogPanel({
  search,
  setSearch,
  catalog,
  onDragStartProduct,
  onOpenAddProduct,
  onOpenIngredients,
}: {
  search: string;
  setSearch: (s: string) => void;
  catalog: Product[];
  onDragStartProduct: (e: React.DragEvent, p: Product) => void;
  onOpenAddProduct: () => void;
  onOpenIngredients: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-gray-500">Product Catalog</div>
          <div className="text-lg font-semibold text-gray-800">Create & Search</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddProduct}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            + Add Product
          </button>
          <button
            onClick={onOpenIngredients}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Ingredients
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {catalog.map((p) => (
          <div
            key={p.productId ?? p.id}
            draggable
            onDragStart={(e) => onDragStartProduct(e, p)}
            className="cursor-grab rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-xs"
            title="Drag into the Menu & Pricing panel"
          >
            {p.name}
            {typeof p.price === "number" ? ` • ₪${p.price}` : ""}
          </div>
        ))}
        {catalog.length === 0 && (
          <div className="text-sm text-gray-400">(no products)</div>
        )}
      </div>
    </div>
  );
}
