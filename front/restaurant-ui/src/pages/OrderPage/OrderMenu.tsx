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
    <div className="rs-surface h-full p-5 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
        {path.map((n, i) => (
          <span key={n.id} className="truncate">
            {i > 0 ? <span className="mx-2">/</span> : null}
            {n.name}
          </span>
        ))}
      </div>

      {current && products.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {products.map((p) => (
            <button
              key={p.id}
              className="rounded-[24px] border border-[var(--border)] bg-[var(--card-muted)] px-4 py-4 text-left transition hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--card)] hover:shadow-[var(--shadow-strong)]"
              onClick={() => onPickProduct(p)}
            >
              <div className="font-medium text-[var(--foreground)]">{p.name}</div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                {p.price != null ? `₪${formatMoney(p.price)}` : "No price yet"}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[26px] border border-dashed border-[var(--border-strong)] bg-[var(--card-muted)] p-6 text-sm text-[var(--muted-foreground)]">
          Choose a category on the right to see products.
        </div>
      )}
    </div>
  );
}
