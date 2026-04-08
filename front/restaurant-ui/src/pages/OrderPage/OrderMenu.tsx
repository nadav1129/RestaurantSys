import { PosPanel, PosStatusPill } from "../../components/ui/pos";
import type { MenuNode, ProductItem } from "./OrderPage";

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return n.toFixed(2).replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

type OrderMenuProps = {
  path: MenuNode[];
  current: MenuNode | null;
  products: ProductItem[];
  onPickProduct: (p: ProductItem) => void;
};

export default function OrderMenu({
  path,
  current,
  products,
  onPickProduct,
}: OrderMenuProps) {
  return (
    <PosPanel
      title={current?.name ?? "Menu"}
      description="Browse products from the active menu structure."
      className="h-full"
      actions={
        <div className="flex flex-wrap gap-2">
          {path.map((node, index) => (
            <PosStatusPill key={node.id} tone={index === path.length - 1 ? "accent" : "default"}>
              {node.name}
            </PosStatusPill>
          ))}
        </div>
      }
    >
      {current && products.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              className="rounded-[1rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),var(--card-muted))] px-4 py-4 text-left transition hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-strong)]"
              onClick={() => onPickProduct(product)}
            >
              <div className="text-base font-semibold text-[var(--foreground)]">{product.name}</div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                {product.price != null ? `₪${formatMoney(product.price)}` : "No price yet"}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[1rem] border border-dashed border-[var(--border-strong)] bg-[var(--card-muted)] p-6 text-sm text-[var(--muted-foreground)]">
          Choose a category to see products.
        </div>
      )}
    </PosPanel>
  );
}
