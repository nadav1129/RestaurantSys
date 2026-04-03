import React from "react";
import Button from "../../../components/Button";
import {
  GripIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "../../../components/icons";
import { EmptyState, SectionCard } from "../../../components/ui/layout";

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
    <SectionCard
      title="Create & Search"
      description="Products now appear in a cleaner management list, with clear scanning, pricing context, and drag-to-menu behavior."
      actions={
        <>
          <Button onClick={onOpenAddProduct}>
            <PlusIcon className="h-4 w-4" />
            Add Product
          </Button>
          <Button variant="secondary" onClick={onOpenIngredients}>
            <SettingsIcon className="h-4 w-4" />
            Ingredients
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            className="rs-input pl-11"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)]">
          <div className="grid grid-cols-[72px_minmax(0,1fr)_120px_150px] gap-3 border-b border-[var(--border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            <div>Drag</div>
            <div>Product</div>
            <div>Price</div>
            <div>Action</div>
          </div>

          {catalog.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Create a product or adjust the current search to start populating this list."
              className="m-4"
            />
          ) : (
            <div className="max-h-[460px] overflow-y-auto">
              {catalog.map((p) => (
                <div
                  key={p.productId ?? p.id}
                  draggable
                  onDragStart={(e) => onDragStartProduct(e, p)}
                  className="grid cursor-grab grid-cols-[72px_minmax(0,1fr)_120px_150px] gap-3 border-b border-[var(--border)] px-4 py-4 transition hover:bg-[var(--card)]"
                  title="Drag into the Menu & Pricing panel"
                >
                  <div className="flex items-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                      <GripIcon className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {p.name}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Product library entry ready to be placed into the selected section.
                    </div>
                  </div>
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {typeof p.price === "number" ? `₪${p.price}` : "—"}
                  </div>
                  <div className="flex items-center text-xs font-medium text-[var(--muted-foreground)]">
                    Drag to pricing
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rs-pill">
          <MenuIcon className="h-4 w-4" />
          Drag any row into the pricing workspace below.
        </div>
      </div>
    </SectionCard>
  );
}
