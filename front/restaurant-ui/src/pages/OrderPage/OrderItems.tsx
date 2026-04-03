import type { CartItem } from "./OrderPage";

type OrderItemsProps = {
  cart: CartItem[];
  onRemove: (index: number) => void;
};

export default function OrderItems({ cart, onRemove }: OrderItemsProps) {
  return (
    <div className="rs-surface h-full p-5 lg:p-6">
      <div className="mb-4 text-lg font-semibold text-[var(--foreground)]">
        Items
      </div>

      {cart.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-[var(--border-strong)] bg-[var(--card-muted)] py-10 text-center text-sm text-[var(--muted-foreground)]">
          No items yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {cart.map((c, idx) => (
            <li
              key={`${c.id}-${idx}`}
              className="rounded-[24px] border border-[var(--border)] bg-[var(--card-muted)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-[var(--foreground)]">
                    {c.qty}× {c.name}
                  </div>
                  {c.additions.length > 0 ? (
                    <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                      + {c.additions.join(", ")}
                    </div>
                  ) : null}
                  {c.notes ? (
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                      “{c.notes}”
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      c.status === "confirmed"
                        ? "bg-[var(--success-surface)] text-[var(--success)]"
                        : "bg-[var(--warning-surface)] text-[var(--warning)]"
                    }`}
                  >
                    {c.status}
                  </span>

                  {c.status === "pending" ? (
                    <button
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                      onClick={() => onRemove(idx)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
