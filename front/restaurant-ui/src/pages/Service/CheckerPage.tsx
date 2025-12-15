// File: src/pages/CheckerPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { apiFetch } from "../../api/api";

/* One meal line inside an order */
type MealLine = {
  id: string;
  name: string;
  qty: number; // ordered
  done: number; // prepared portions
  verified: boolean; // true after checker clicks ✓
};

/* An order that came into the kitchen/checker */
type CheckerOrder = {
  orderId: string;
  table: string; // table / pickup / delivery etc. (backend returns "table")
  createdAt: string; // ISO string
  meals: MealLine[];
};

type DragInfo = {
  list: "main" | "queue";
  index: number;
};

type ConfirmConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type CheckerState = {
  main: CheckerOrder[];
  queue: CheckerOrder[];
};

export default function CheckerPage() {
  /* Single state object to avoid nested setState issues */
  const [checker, setChecker] = useState<CheckerState>({
    main: [],
    queue: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [colorsEnabled, setColorsEnabled] = useState(true);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const ordersMain = checker.main;
  const ordersQueue = checker.queue;

  const allOrders = useMemo(
    () => [...ordersMain, ...ordersQueue],
    [ordersMain, ordersQueue]
  );

  /* Right-side summary: aggregate remaining meals across all orders */
  const remaining = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number }>();
    for (const o of allOrders) {
      for (const m of o.meals) {
        const rem = m.qty - m.done;
        if (rem <= 0) continue;
        const prev = map.get(m.id);
        if (prev) prev.qty += rem;
        else map.set(m.id, { id: m.id, name: m.name, qty: rem });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [allOrders]);

  const showConfirm = (cfg: ConfirmConfig) => {
    setConfirm(cfg);
  };

  /* + : mark ONE more portion as prepared (if possible) */
  const addPrepared = (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => {
    setChecker((prev) => ({
      ...prev,
      [list]: prev[list].map((o) =>
        o.orderId !== orderId
          ? o
          : {
              ...o,
              meals: o.meals.map((m) => {
                if (m.id !== mealId) return m;
                if (m.done >= m.qty) return m;
                return { ...m, done: m.done + 1 };
              }),
            }
      ),
    }));
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = (await apiFetch("/api/checker/orders")) as CheckerOrder[];

      setChecker({
        main: Array.isArray(data) ? data : [],
        queue: [], // we don't use queue yet
      });
    } catch (e: any) {
      console.error("Failed to load checker orders", e);
      setError(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  /* - : revert ONE prepared portion (if any) */
  const removePrepared = (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => {
    setChecker((prev) => ({
      ...prev,
      [list]: prev[list].map((o) =>
        o.orderId !== orderId
          ? o
          : {
              ...o,
              meals: o.meals.map((m) => {
                if (m.id !== mealId) return m;
                if (m.done <= 0) return m;
                return { ...m, done: m.done - 1 };
              }),
            }
      ),
    }));
  };

  const markReady = async (orderId: string, productId: string) => {
    const res = (await apiFetch(
      `/api/checker/orders/${orderId}/items/${productId}/ready`,
      { method: "PATCH" }
    )) as { ok?: boolean; affected?: number };

    if (!res || res.ok !== true) {
      throw new Error("Failed to mark item ready");
    }
  };

  // Dismiss entire order (after all lines verified)
  const dismissOrder = async (orderId: string) => {
  const res = (await apiFetch(`/api/checker/orders/${orderId}/dismiss`, {
    method: "PATCH",
  })) as { ok?: boolean; affected?: number };

  if (!res?.ok) throw new Error("Failed to dismiss order");
};


  /* Core verify: PATCH backend + mark line verified + ensure prepared = ordered */
  const verifyLineForce = async (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => {
    try {
      setError(null);
      await markReady(orderId, mealId);

      setChecker((prev) => ({
        ...prev,
        [list]: prev[list].map((o) =>
          o.orderId !== orderId
            ? o
            : {
                ...o,
                meals: o.meals.map((m) => {
                  if (m.id !== mealId) return m;
                  const newDone = m.done < m.qty ? m.qty : m.done;
                  return { ...m, done: newDone, verified: true };
                }),
              }
        ),
      }));
    } catch (e: any) {
      console.error("Failed to mark ready", e);
      setError(e?.message ?? "Failed to mark item ready");
    }
  };

  /* ✓ : verify line; if done < qty, ask confirmation via panel */
  const verifyLine = (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => {
    const orders = list === "main" ? ordersMain : ordersQueue;
    const order = orders.find((o) => o.orderId === orderId);
    const meal = order?.meals.find((m) => m.id === mealId);
    if (!meal) return;

    if (meal.done < meal.qty) {
      showConfirm({
        title: "Mark meal as ready?",
        message:
          "Prepared is less than ordered. Mark the rest as prepared and verify this item?",
        confirmLabel: "Yes, mark as prepared",
        cancelLabel: "Cancel",
        onConfirm: () => {
          void verifyLineForce(list, orderId, mealId);
        },
      });
    } else {
      void verifyLineForce(list, orderId, mealId);
    }
  };

  /* Move order between main and queue (no duplication, single state) */
  const moveToQueue = (orderId: string) => {
    setChecker((prev) => {
      const idx = prev.main.findIndex((o) => o.orderId === orderId);
      if (idx === -1) return prev;
      const order = prev.main[idx];
      return {
        main: [...prev.main.slice(0, idx), ...prev.main.slice(idx + 1)],
        queue: [...prev.queue, order],
      };
    });
  };

  const moveToMain = (orderId: string) => {
    setChecker((prev) => {
      const idx = prev.queue.findIndex((o) => o.orderId === orderId);
      if (idx === -1) return prev;
      const order = prev.queue[idx];
      return {
        main: [...prev.main, order],
        queue: [...prev.queue.slice(0, idx), ...prev.queue.slice(idx + 1)],
      };
    });
  };

  /* Delete card with confirmation if not all lines are green */
  const deleteOrderForce = async (list: "main" | "queue", orderId: string) => {
  try {
    setError(null);
    await dismissOrder(orderId);

    setChecker((prev) => ({
      ...prev,
      [list]: prev[list].filter((o) => o.orderId !== orderId),
    }));
  } catch (e: any) {
    console.error("Failed to dismiss order", e);
    setError(e?.message ?? "Failed to delete order");
  }
};


  const deleteOrder = (list: "main" | "queue", order: CheckerOrder) => {
    const allGreen =
      order.meals.length > 0 && order.meals.every((m) => m.verified);

    if (!allGreen) {
      showConfirm({
        title: "Delete order?",
        message:
          "Not all meals in this order are verified (green). Are you sure you want to delete this card?",
        confirmLabel: "Delete anyway",
        cancelLabel: "Cancel",
        onConfirm: () => void deleteOrderForce(list, order.orderId),
      });
    } else {
      void deleteOrderForce(list, order.orderId);
    }
  };

  /* Drag & drop reordering inside a list */
  const onDragStartCard = (list: "main" | "queue", index: number) => {
    setDragInfo({ list, index });
  };

  const onDropCard = (targetList: "main" | "queue", targetIndex: number) => {
    if (!dragInfo || dragInfo.list !== targetList) {
      setDragInfo(null);
      return;
    }

    setChecker((prev) => {
      const listArr = [...prev[targetList]];
      const [moved] = listArr.splice(dragInfo.index, 1);
      listArr.splice(targetIndex, 0, moved);
      return {
        ...prev,
        [targetList]: listArr,
      };
    });

    setDragInfo(null);
  };

  const onDragOverCard: React.DragEventHandler<HTMLLIElement> = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[2fr_1fr]">
        {/* Left side: Queue + Main orders */}
        <div className="space-y-4">
          {/* Top controls */}
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <div>
              <div className="text-xs font-medium text-gray-500">Checker</div>
              <div className="text-sm font-semibold text-gray-900">
                Orders & Queue
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setColorsEnabled((v) => !v)}
              >
                Colors: {colorsEnabled ? "On" : "Off"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  // Placeholder for real past orders view
                  console.log("Past orders clicked");
                }}
              >
                Past Orders
              </Button>
            </div>
          </div>
          {loading && (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              Loading checker orders…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <div className="mt-2">
                <Button type="button" variant="secondary" onClick={loadOrders}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Queue panel */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500">Queue</div>
                <div className="text-sm font-semibold text-gray-900">
                  Special tables
                </div>
                <div className="text-xs text-gray-500">
                  Pull specific tables here for dynamic attention.
                </div>
              </div>
            </div>
            {ordersQueue.length === 0 ? (
              <div className="text-sm text-gray-400">
                Queue is empty – use{" "}
                <span className="font-medium">Move to queue</span> on a table if
                you want to handle it separately.
              </div>
            ) : (
              <ul className="space-y-3">
                {ordersQueue.map((o, index) => {
                  const allGreen =
                    o.meals.length > 0 && o.meals.every((m) => m.verified);
                  return (
                    <li
                      key={o.orderId}
                      draggable
                      onDragStart={() => onDragStartCard("queue", index)}
                      onDragOver={onDragOverCard}
                      onDrop={() => onDropCard("queue", index)}
                      className={
                        "rounded-xl border p-3 transition " +
                        (colorsEnabled && allGreen
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-gray-50")
                      }
                    >
                      <OrderCardHeader
                        order={o}
                        list="queue"
                        onMoveBetweenLists={() => moveToMain(o.orderId)}
                        onDelete={() => deleteOrder("queue", o)}
                      />
                      <MealList
                        list="queue"
                        order={o}
                        colorsEnabled={colorsEnabled}
                        onAddPrepared={addPrepared}
                        onRemovePrepared={removePrepared}
                        onVerifyLine={verifyLine}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Main orders panel */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500">Orders</div>
                <div className="text-sm font-semibold text-gray-900">
                  Active food orders (main)
                </div>
                <div className="text-xs text-gray-500">
                  Ordered by your custom drag-drop priority.
                </div>
              </div>
            </div>

            {ordersMain.length === 0 ? (
              <div className="text-sm text-gray-500">
                No active food orders in main panel.
              </div>
            ) : (
              <ul className="space-y-3">
                {ordersMain.map((o, index) => {
                  const allGreen =
                    o.meals.length > 0 && o.meals.every((m) => m.verified);
                  return (
                    <li
                      key={o.orderId}
                      draggable
                      onDragStart={() => onDragStartCard("main", index)}
                      onDragOver={onDragOverCard}
                      onDrop={() => onDropCard("main", index)}
                      className={
                        "rounded-xl border p-3 transition " +
                        (colorsEnabled && allGreen
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-gray-50")
                      }
                    >
                      <OrderCardHeader
                        order={o}
                        list="main"
                        onMoveBetweenLists={() => moveToQueue(o.orderId)}
                        onDelete={() => deleteOrder("main", o)}
                      />
                      <MealList
                        list="main"
                        order={o}
                        colorsEnabled={colorsEnabled}
                        onAddPrepared={addPrepared}
                        onRemovePrepared={removePrepared}
                        onVerifyLine={verifyLine}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Right side: summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-500">Summary</div>
            <div className="text-sm font-semibold text-gray-900">
              Meals to prepare
            </div>
            <div className="text-xs text-gray-500">
              Aggregated remaining portions across all open orders (main +
              queue).
            </div>
          </div>

          {remaining.length === 0 ? (
            <div className="text-sm text-gray-400">All meals prepared.</div>
          ) : (
            <ul className="space-y-2">
              {remaining.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>{m.name}</span>
                  <span className="font-semibold">× {m.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Small in-app confirm panel (no browser UI) */}
      {confirm && (
        <ConfirmPanel config={confirm} onCancel={() => setConfirm(null)} />
      )}
    </>
  );
}

/* Header for each order card (table) */
function OrderCardHeader({
  order,
  list,
  onMoveBetweenLists,
  onDelete,
}: {
  order: CheckerOrder;
  list: "main" | "queue";
  onMoveBetweenLists: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div>
        <div className="font-semibold">
          {order.table} ·{" "}
          <span className="text-xs font-normal text-gray-500">
            {fmtTime(order.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onMoveBetweenLists}>
          {list === "main" ? "Move to queue" : "Back to main"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

/* Meal lines for an order */
function MealList({
  list,
  order,
  colorsEnabled,
  onAddPrepared,
  onRemovePrepared,
  onVerifyLine,
}: {
  list: "main" | "queue";
  order: CheckerOrder;
  colorsEnabled: boolean;
  onAddPrepared: (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => void;
  onRemovePrepared: (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => void;
  onVerifyLine: (
    list: "main" | "queue",
    orderId: string,
    mealId: string
  ) => void;
}) {
  return (
    <ul className="space-y-2">
      {order.meals.map((m) => {
        const rem = m.qty - m.done;
        const allDone = rem <= 0;

        let colorClass = "bg-white";
        if (colorsEnabled) {
          if (m.verified) {
            colorClass = "bg-green-50";
          } else if (m.done > 0 && m.done < m.qty) {
            colorClass = "bg-yellow-50";
          } else if (m.done === m.qty && m.qty > 0) {
            colorClass = "bg-blue-50";
          }
        }

        return (
          <li
            key={m.id + order.orderId}
            className={
              "flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 " +
              colorClass
            }
          >
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-gray-500">
                Ordered: {m.qty} · Prepared: {m.done} · Remaining: {rem}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* - button: revert prepared */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRemovePrepared(list, order.orderId, m.id)}
                disabled={m.done === 0}
              >
                -
              </Button>

              {/* + button: adds prepared, cannot click if prepared == ordered */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => onAddPrepared(list, order.orderId, m.id)}
                disabled={allDone}
              >
                +
              </Button>

              {/* ✓ button: verify (with confirmation if done < qty) */}
              <Button
                type="button"
                onClick={() => onVerifyLine(list, order.orderId, m.id)}
              >
                ✓
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* Reusable inline confirmation panel */
function ConfirmPanel({
  config,
  onCancel,
}: {
  config: ConfirmConfig;
  onCancel: () => void;
}) {
  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
  } = config;
  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto mx-4 max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-xs text-gray-600 whitespace-pre-line">
          {message}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
