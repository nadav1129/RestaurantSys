import { PosPanel, PosStatusPill } from "../../components/ui/pos";
import { formatMoney } from "../../utils/money";
import type { CartItem } from "./OrderPage";

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
    <PosPanel title="Items" description="Live check detail for the current order." className="h-full">
      {cart.length === 0 ? (
        <div className="rounded-[1rem] border border-dashed border-[var(--border-strong)] bg-[var(--card-muted)] py-10 text-center text-sm text-[var(--muted-foreground)]">
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
                className="rounded-[1rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),var(--card-muted))] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={[
                        "text-base font-semibold",
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
                    <div className="mt-3 text-sm font-medium text-[var(--foreground)]">
                      {isRemoved ? "NIS 0" : `NIS ${formatMoney(lineTotal)}`}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <PosStatusPill
                      tone={
                        isPending
                          ? "warning"
                          : isRemoved
                            ? "default"
                            : "success"
                      }
                    >
                      {isPending
                        ? "pending"
                        : isRemoved
                          ? "removed"
                          : item.cancelRequestStatus === "requested"
                            ? "cancel requested"
                            : "confirmed"}
                    </PosStatusPill>

                    {isPending ? (
                      <button
                        className="rounded-[0.9rem] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                        onClick={() => onRemove(index)}
                      >
                        Remove
                      </button>
                    ) : null}

                    {canRequestCancel ? (
                      <button
                        className="rounded-[0.9rem] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
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
    </PosPanel>
  );
}
