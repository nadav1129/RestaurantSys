import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { apiFetch } from "../../api/api";
import type { CheckerStationSettings, Station } from "../../types";

type MealLine = {
  id: string;
  name: string;
  qty: number;
  done: number;
  verified: boolean;
  cancelled: boolean;
};

type CheckerOrder = {
  orderId: string;
  table: string;
  createdAt: string;
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

export default function CheckerPage({ station }: { station?: Station }) {
  const [checker, setChecker] = useState<CheckerState>({
    main: [],
    queue: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorsEnabled, setColorsEnabled] = useState(true);
  const [printEnabled, setPrintEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const ordersMain = checker.main;
  const ordersQueue = checker.queue;

  const allOrders = useMemo(
    () => [...ordersMain, ...ordersQueue],
    [ordersMain, ordersQueue]
  );

  const remaining = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number }>();
    for (const order of allOrders) {
      for (const meal of order.meals) {
        if (meal.cancelled) continue;
        const rem = meal.qty - meal.done;
        if (rem <= 0) continue;

        const key = meal.name;
        const prev = map.get(key);
        if (prev) prev.qty += rem;
        else map.set(key, { id: key, name: meal.name, qty: rem });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allOrders]);

  const showConfirm = (cfg: ConfirmConfig) => {
    setConfirm(cfg);
  };

  const addPrepared = (list: "main" | "queue", orderId: string, mealId: string) => {
    setChecker((prev) => ({
      ...prev,
      [list]: prev[list].map((order) =>
        order.orderId !== orderId
          ? order
          : {
              ...order,
              meals: order.meals.map((meal) => {
                if (meal.id !== mealId || meal.cancelled) return meal;
                if (meal.done >= meal.qty) return meal;
                return { ...meal, done: meal.done + 1 };
              }),
            }
      ),
    }));
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = (await apiFetch("/api/checker/orders", {
        query: station?.stationId ? { stationId: station.stationId } : undefined,
      })) as CheckerOrder[];

      setChecker({
        main: Array.isArray(data) ? data : [],
        queue: [],
      });
    } catch (e: any) {
      console.error("Failed to load checker orders", e);
      setError(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [station?.stationId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (!station?.stationId) {
        if (!cancelled) {
          setPrintEnabled(false);
          setSettingsLoaded(true);
        }
        return;
      }

      try {
        const data = (await apiFetch(
          `/api/stations/${station.stationId}/checker-settings`
        )) as CheckerStationSettings | null;

        if (!cancelled) {
          setPrintEnabled(!!data?.printEnabled);
          setSettingsLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load checker settings", e);
        if (!cancelled) {
          setPrintEnabled(false);
          setSettingsLoaded(true);
        }
      }
    }

    setSettingsLoaded(false);
    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [station?.stationId]);

  async function togglePrint() {
    const next = !printEnabled;
    setPrintEnabled(next);

    if (!station?.stationId) return;

    try {
      const saved = (await apiFetch(
        `/api/stations/${station.stationId}/checker-settings`,
        {
          method: "PUT",
          body: { printEnabled: next },
        }
      )) as CheckerStationSettings | null;

      setPrintEnabled(!!saved?.printEnabled);
    } catch (e: any) {
      console.error("Failed to save print setting", e);
      setPrintEnabled((prev) => !prev);
      setError(e?.message ?? "Failed to save print setting");
    }
  }

  const removePrepared = (list: "main" | "queue", orderId: string, mealId: string) => {
    setChecker((prev) => ({
      ...prev,
      [list]: prev[list].map((order) =>
        order.orderId !== orderId
          ? order
          : {
              ...order,
              meals: order.meals.map((meal) => {
                if (meal.id !== mealId || meal.cancelled) return meal;
                if (meal.done <= 0) return meal;
                return { ...meal, done: meal.done - 1 };
              }),
            }
      ),
    }));
  };

  const markReady = async (orderId: string, orderItemId: string) => {
    const res = (await apiFetch(
      `/api/checker/orders/${orderId}/items/${orderItemId}/ready`,
      { method: "PATCH" }
    )) as { ok?: boolean; affected?: number };

    if (!res || res.ok !== true) {
      throw new Error("Failed to mark item ready");
    }
  };

  const dismissOrder = async (orderId: string) => {
    const res = (await apiFetch(`/api/checker/orders/${orderId}/dismiss`, {
      method: "PATCH",
    })) as { ok?: boolean; affected?: number };

    if (!res?.ok) throw new Error("Failed to dismiss order");
  };

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
        [list]: prev[list].map((order) =>
          order.orderId !== orderId
            ? order
            : {
                ...order,
                meals: order.meals.map((meal) => {
                  if (meal.id !== mealId) return meal;
                  const newDone = meal.done < meal.qty ? meal.qty : meal.done;
                  return {
                    ...meal,
                    done: newDone,
                    verified: true,
                    cancelled: false,
                  };
                }),
              }
        ),
      }));
    } catch (e: any) {
      console.error("Failed to mark ready", e);
      setError(e?.message ?? "Failed to mark item ready");
    }
  };

  const verifyLine = (list: "main" | "queue", orderId: string, mealId: string) => {
    const orders = list === "main" ? ordersMain : ordersQueue;
    const order = orders.find((o) => o.orderId === orderId);
    const meal = order?.meals.find((m) => m.id === mealId);
    if (!meal || meal.cancelled) return;

    if (meal.done < meal.qty) {
      showConfirm({
        title: "Mark meal as ready?",
        message: "Prepared is less than ordered. Mark the rest as prepared and verify this item?",
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
      order.meals.length > 0 &&
      order.meals.every((meal) => meal.verified || meal.cancelled);

    if (!allGreen) {
      showConfirm({
        title: "Delete order?",
        message:
          "Not all meals in this order are verified or cancelled. Are you sure you want to delete this card?",
        confirmLabel: "Delete anyway",
        cancelLabel: "Cancel",
        onConfirm: () => void deleteOrderForce(list, order.orderId),
      });
    } else {
      void deleteOrderForce(list, order.orderId);
    }
  };

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
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <div>
              <div className="text-xs font-medium text-gray-500">Checker</div>
              <div className="text-sm font-semibold text-gray-900">Orders & Queue</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={togglePrint}
                disabled={!settingsLoaded}
              >
                Print: {printEnabled ? "On" : "Off"}
              </Button>
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
                  console.log("Past orders clicked");
                }}
              >
                Past Orders
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              Loading checker orders...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <div className="mt-2">
                <Button type="button" variant="secondary" onClick={loadOrders}>
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500">Queue</div>
                <div className="text-sm font-semibold text-gray-900">Special tables</div>
                <div className="text-xs text-gray-500">
                  Pull specific tables here for dynamic attention.
                </div>
              </div>
            </div>
            {ordersQueue.length === 0 ? (
              <div className="text-sm text-gray-400">
                Queue is empty. Use Move to queue on an order if you want to handle it separately.
              </div>
            ) : (
              <ul className="space-y-3">
                {ordersQueue.map((order, index) => {
                  const allGreen =
                    order.meals.length > 0 &&
                    order.meals.every((meal) => meal.verified || meal.cancelled);

                  return (
                    <li
                      key={order.orderId}
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
                        order={order}
                        list="queue"
                        onMoveBetweenLists={() => moveToMain(order.orderId)}
                        onDelete={() => deleteOrder("queue", order)}
                      />
                      <MealList
                        list="queue"
                        order={order}
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
              <div className="text-sm text-gray-500">No active food orders in main panel.</div>
            ) : (
              <ul className="space-y-3">
                {ordersMain.map((order, index) => {
                  const allGreen =
                    order.meals.length > 0 &&
                    order.meals.every((meal) => meal.verified || meal.cancelled);

                  return (
                    <li
                      key={order.orderId}
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
                        order={order}
                        list="main"
                        onMoveBetweenLists={() => moveToQueue(order.orderId)}
                        onDelete={() => deleteOrder("main", order)}
                      />
                      <MealList
                        list="main"
                        order={order}
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

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-500">Summary</div>
            <div className="text-sm font-semibold text-gray-900">Meals to prepare</div>
            <div className="text-xs text-gray-500">
              Aggregated remaining portions across all open orders (main + queue).
            </div>
          </div>

          {remaining.length === 0 ? (
            <div className="text-sm text-gray-400">All meals prepared.</div>
          ) : (
            <ul className="space-y-2">
              {remaining.map((meal) => (
                <li
                  key={meal.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>{meal.name}</span>
                  <span className="font-semibold">x {meal.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirm ? <ConfirmPanel config={confirm} onCancel={() => setConfirm(null)} /> : null}
    </>
  );
}

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
          {order.table} - <span className="text-xs font-normal text-gray-500">{fmtTime(order.createdAt)}</span>
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
  onAddPrepared: (list: "main" | "queue", orderId: string, mealId: string) => void;
  onRemovePrepared: (list: "main" | "queue", orderId: string, mealId: string) => void;
  onVerifyLine: (list: "main" | "queue", orderId: string, mealId: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {order.meals.map((meal) => {
        const rem = meal.cancelled ? 0 : meal.qty - meal.done;
        const allDone = rem <= 0;

        let colorClass = "bg-white";
        if (colorsEnabled) {
          if (meal.cancelled) {
            colorClass = "bg-red-50";
          } else if (meal.verified) {
            colorClass = "bg-green-50";
          } else if (meal.done > 0 && meal.done < meal.qty) {
            colorClass = "bg-yellow-50";
          } else if (meal.done === meal.qty && meal.qty > 0) {
            colorClass = "bg-blue-50";
          }
        }

        return (
          <li
            key={meal.id + order.orderId}
            className={
              "flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 " +
              colorClass
            }
          >
            <div>
              <div
                className={[
                  "font-medium",
                  meal.cancelled ? "text-red-700 line-through" : "",
                ].join(" ")}
              >
                {meal.name}
              </div>
              <div className="text-xs text-gray-500">
                {meal.cancelled
                  ? `Cancelled - Ordered: ${meal.qty}`
                  : `Ordered: ${meal.qty} - Prepared: ${meal.done} - Remaining: ${rem}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {meal.cancelled ? (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  Cancelled
                </span>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onRemovePrepared(list, order.orderId, meal.id)}
                    disabled={meal.done === 0}
                  >
                    -
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onAddPrepared(list, order.orderId, meal.id)}
                    disabled={allDone}
                  >
                    +
                  </Button>

                  <Button
                    type="button"
                    onClick={() => onVerifyLine(list, order.orderId, meal.id)}
                  >
                    Ready
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

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
        <div className="mt-1 whitespace-pre-line text-xs text-gray-600">{message}</div>
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
