import type { ProductItem } from "./OrderPage";
import Button from "../../components/Button";

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
  product,
  qty,
  setQty,
  notes,
  setNotes,
  adds,
  setAdds,
  onCancel,
  onAdd,
}: ItemDetailsProps) {
  const toggleAdd = (name: string) =>
    setAdds(adds.includes(name) ? adds.filter((x) => x !== name) : [...adds, name]);

  return (
    <div className="rs-surface h-full p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {product.name}
          </div>
          {product.price != null ? (
            <div className="mt-2 text-sm text-[var(--muted-foreground)]">
              Unit price {product.price}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--muted-foreground)]">Qty</span>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] transition hover:bg-[var(--muted)]"
          onClick={() => setQty(Math.max(1, qty - 1))}
        >
          −
        </button>
        <span className="w-10 text-center text-lg font-semibold text-[var(--foreground)]">
          {qty}
        </span>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] transition hover:bg-[var(--muted)]"
          onClick={() => setQty(qty + 1)}
        >
          +
        </button>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Additions
        </div>
        <div className="flex flex-wrap gap-2">
          {["Extra Ice", "Lemon", "Tonic", "Mint"].map((a) => {
            const active = adds.includes(a);
            return (
              <button
                key={a}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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

      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold text-[var(--foreground)]">
          Notes
        </div>
        <textarea
          className="rs-textarea min-h-[120px]"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="No sugar, half ice..."
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onAdd}>Add to order</Button>
      </div>
    </div>
  );
}
