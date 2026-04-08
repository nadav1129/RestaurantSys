import Button from "../../components/Button";
import { PosPanel, PosStatusPill } from "../../components/ui/pos";
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
    <PosPanel
      title={product.name}
      description={product.price != null ? `Unit price ${product.price}` : "No price yet"}
      className="h-full"
      tone="highlight"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rs-pos-section-kicker">Quantity</span>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[var(--border)] bg-[var(--card-muted)] transition hover:bg-[var(--muted)]"
            onClick={() => setQty(Math.max(1, qty - 1))}
          >
            -
          </button>
          <span className="w-12 text-center text-xl font-semibold text-[var(--foreground)]">
            {qty}
          </span>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[var(--border)] bg-[var(--card-muted)] transition hover:bg-[var(--muted)]"
            onClick={() => setQty(qty + 1)}
          >
            +
          </button>
        </div>

        <div>
          <div className="mb-3 text-sm font-semibold text-[var(--foreground)]">Additions</div>
          <div className="flex flex-wrap gap-2">
            {["Extra Ice", "Lemon", "Tonic", "Mint"].map((addition) => {
              const active = adds.includes(addition);
              return (
                <button
                  key={addition}
                  className={[
                    "rounded-full px-4 py-2 text-sm transition",
                    active
                      ? "bg-[var(--highlight)] text-[var(--accent-foreground)]"
                      : "border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                  ].join(" ")}
                  onClick={() => toggleAdd(addition)}
                  aria-pressed={active}
                >
                  {addition}
                </button>
              );
            })}
          </div>
          {adds.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {adds.map((addition) => (
                <PosStatusPill key={addition} tone="accent">
                  {addition}
                </PosStatusPill>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-[var(--foreground)]">Notes</div>
          <textarea
            className="rs-textarea min-h-[120px]"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="No sugar, half ice..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onAdd}>Add to order</Button>
        </div>
      </div>
    </PosPanel>
  );
}
