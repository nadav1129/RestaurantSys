import type { CartItem } from "./OrderPage";
import { formatMoney } from "../../utils/money";

type OrderItemsProps = {
  cart: CartItem[];
  onRemove: (index: number) => void;
  onRequestCancel: (orderItemId: string) => void;
};

export default function OrderItems({
  cart,
  onRemove,
  onRequestCancel,
}: OrderItemsProps) {
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
          {cart.map((item, index) => {
            const lineTotal = item.qty * item.price;
            const isPending = item.status === "pending";
            const isRemoved = item.status === "removed";
            const canRequestCancel =
              item.status === "confirmed" &&
              item.orderItemId &&
              (item.cancelRequestStatus === "none" ||
                item.cancelRequestStatus === "rejected");

            return (
              <li
                key={item.localKey}
                className="rounded-[24px] border border-[var(--border)] bg-[var(--card-muted)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={[
                        "font-medium",
                        isRemoved
                          ? "text-[var(--muted-foreground)] line-through"
                          : "text-[var(--foreground)]",
                      ].join(" ")}
                    >
                      {item.qty}x {item.name}
                    </div>
                    {item.additions.length > 0 ? (
                      <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                        + {item.additions.join(", ")}
                      </div>
                    ) : null}
                    {item.notes ? (
                      <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                        "{item.notes}"
                      </div>
                    ) : null}
                    <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {isRemoved ? "NIS 0" : `NIS ${formatMoney(lineTotal)}`}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        isPending
                          ? "bg-[var(--warning-surface)] text-[var(--warning)]"
                          : isRemoved
                            ? "bg-[var(--border)] text-[var(--muted-foreground)]"
                            : "bg-[var(--success-surface)] text-[var(--success)]",
                      ].join(" ")}
                    >
                      {isPending
                        ? "pending"
                        : isRemoved
                          ? "removed"
                          : item.cancelRequestStatus === "requested"
                            ? "cancel requested"
                            : "confirmed"}
                    </span>

                    {isPending ? (
                      <button
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                        onClick={() => onRemove(index)}
                      >
                        Remove
                      </button>
                    ) : null}

                    {canRequestCancel ? (
                      <button
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                        onClick={() => onRequestCancel(item.orderItemId!)}
                      >
                        Request cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
