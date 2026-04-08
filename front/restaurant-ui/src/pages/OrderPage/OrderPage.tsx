import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../api/api";
import OrderInfoCard from "./OrderInfoCard";
import OrderMenu from "./OrderMenu";
import ItemDetails from "./ItemDetails";
import OrderItems from "./OrderItems";
import PaymentScreen, { type FinalizedPaymentLine } from "./PaymentScreen";
import { PosPanel, PosStatusPill } from "../../components/ui/pos";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizePrice(raw: number | null): number | null {
  if (raw == null) return null;
  if (Number.isInteger(raw) && raw >= 100) return raw / 100;
  return raw;
}

export type ProductItem = {
  id: string;
  name: string;
  type: string;
  price: number | null;
};

export type MenuNode = {
  id: string;
  name: string;
  isLeaf?: boolean;
  children?: MenuNode[];
  products?: ProductItem[];
};

export type CartItem = {
  localKey: string;
  orderItemId?: string | null;
  id: string;
  name: string;
  qty: number;
  price: number;
  additions: string[];
  notes?: string;
  status: "pending" | "confirmed" | "removed";
  cancelRequestStatus: "none" | "requested" | "rejected" | "approved";
};

type ShiftDto = { shiftId: string; openedAt: string };
type SettingsDto = {
  activeMenuNum: number | null;
  globalDiscountPct?: number | null;
};

type OrderPageProps = {
  initialTableNum?: string | null;
  initialTableId?: string | null;
  originStationId?: string | null;
};

type ActiveOrderItemDto = {
  orderItemId: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number | string;
  itemStatus: string;
  cancelRequestStatus: "none" | "requested" | "rejected" | "approved";
};

type ActiveOrderDto = {
  orderId: string | null;
  items: ActiveOrderItemDto[];
};

export default function OrderPage({
  initialTableNum = null,
  initialTableId = null,
  originStationId = null,
}: OrderPageProps) {
  const [table, setTable] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [diners, setDiners] = useState("");
  const [note, setNote] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);

  const [activeShift, setActiveShift] = useState<ShiftDto | null>(null);
  const [settings, setSettings] = useState<SettingsDto | null>(null);

  const [path, setPath] = useState<MenuNode[]>([]);
  const current = path[path.length - 1] ?? null;

  const productCacheRef = useRef<Map<string, ProductItem[]>>(new Map());
  const cartRef = useRef<CartItem[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [mode, setMode] = useState<"browse" | "details">("browse");
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  const [customQty, setCustomQty] = useState(1);
  const [customNotes, setCustomNotes] = useState("");
  const [customAdds, setCustomAdds] = useState<string[]>([]);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const subtotal = round2(
    cart.reduce((sum, item) => (item.status === "removed" ? sum : sum + item.qty * item.price), 0)
  );
  const total = subtotal;
  const only10 = round2(total * 0.1);
  const totalWith10 = round2(total + only10);
  const minimum = total;

  const hasPending = cart.some((x) => x.status === "pending");
  const hasFinalizedItems = cart.some((x) => x.status !== "pending");

  useEffect(() => {
    if (initialTableNum != null && initialTableNum !== "") {
      setTable(String(initialTableNum));
    } else {
      try {
        const last = sessionStorage.getItem("lastTableNum");
        if (last && last !== "") setTable(last);
      } catch {
        // ignore
      }
    }

    if (initialTableId != null) setTableId(initialTableId);
  }, [initialTableNum, initialTableId]);

  useEffect(() => {
    void (async () => {
      try {
        const shift = await apiFetch<ShiftDto | null>("/api/shifts/active");
        setActiveShift(shift ?? null);
      } catch (e) {
        console.error("Active shift load failed", e);
      }
    })();

    void (async () => {
      try {
        const loadedSettings = await apiFetch<SettingsDto | null>("/api/settings");
        setSettings(loadedSettings ?? null);
      } catch (e) {
        console.error("Settings load failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const activeMenu = settings?.activeMenuNum ?? null;
        if (activeMenu == null) return;

        const children = await apiFetch<any[]>(`/api/menu-nodes?menu=${activeMenu}`);
        const mapCategory = (node: any): MenuNode => ({
          id: node.id,
          name: node.name,
          isLeaf: !!node.isLeaf,
          children: (node.children ?? []).map(mapCategory),
        });

        setPath([
          {
            id: "root",
            name: "Menu",
            isLeaf: false,
            children: (children ?? []).map(mapCategory),
          },
        ]);
      } catch (e) {
        console.error("Menu categories load failed", e);
      }
    })();
  }, [settings?.activeMenuNum]);

  function mapActiveItem(item: ActiveOrderItemDto): CartItem {
    const price = normalizePrice(Number(item.unitPrice)) ?? 0;
    const removed =
      item.itemStatus === "cancelled" || item.cancelRequestStatus === "approved";

    return {
      localKey: `server-${item.orderItemId}`,
      orderItemId: item.orderItemId,
      id: item.productId,
      name: item.name,
      qty: item.qty,
      price,
      additions: [],
      status: removed ? "removed" : "confirmed",
      cancelRequestStatus: item.cancelRequestStatus ?? "none",
    };
  }

  async function reloadActiveOrder() {
    if (!activeShift?.shiftId) return;

    const qs = new URLSearchParams();
    qs.set("shiftId", activeShift.shiftId);

    if (tableId) qs.set("tableId", tableId);
    else if (table && table !== "none") qs.set("tableNum", table);
    else qs.set("table", "none");

    try {
      const res = await apiFetch<ActiveOrderDto>(`/api/orders/active?${qs.toString()}`);
      const localPending = cartRef.current.filter((x) => x.status === "pending");

      if (!res?.orderId) {
        setOrderId(null);
        setCart(localPending);
        return;
      }

      setOrderId(res.orderId);
      setCart([...(res.items ?? []).map(mapActiveItem), ...localPending]);
    } catch (e) {
      console.error("Load active order failed", e);
    }
  }

  useEffect(() => {
    if (!activeShift?.shiftId) return;

    void reloadActiveOrder();
    const id = window.setInterval(() => {
      void reloadActiveOrder();
    }, 5000);

    return () => window.clearInterval(id);
  }, [activeShift?.shiftId, tableId, table]);

  useEffect(() => {
    if (!current) return;

    const looksLeaf =
      current.isLeaf === true ||
      !current.children ||
      current.children.length === 0;

    if (!looksLeaf) return;
    if (Array.isArray(current.products)) return;

    const cached = productCacheRef.current.get(current.id);
    if (cached) {
      setPath((prev) => {
        const next = prev.slice();
        next[next.length - 1] = { ...current, products: cached, isLeaf: true };
        return next;
      });
      return;
    }

    void (async () => {
      try {
        const raw = await apiFetch<ProductItem[]>(`/api/menu-nodes/${current.id}/products`);
        const products = (raw ?? []).map((product) => ({
          ...product,
          price: normalizePrice(product.price),
        }));

        productCacheRef.current.set(current.id, products);
        setPath((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            ...current,
            products,
            isLeaf: true,
          };
          return next;
        });
      } catch (e) {
        console.error("Products load failed for", current.id, e);
      }
    })();
  }, [current?.id]);

  const products = useMemo<ProductItem[]>(() => current?.products ?? [], [current?.products]);

  const enterNode = (node: MenuNode) => setPath((prev) => [...prev, node]);
  const goUpOne = () => {
    if (path.length > 1) setPath((prev) => prev.slice(0, prev.length - 1));
  };

  const onPickProduct = (product: ProductItem) => {
    setSelectedProduct(product);
    setCustomQty(1);
    setCustomNotes("");
    setCustomAdds([]);
    setMode("details");
  };

  const addToCart = () => {
    if (!selectedProduct) return;

    setCart((prev) => [
      ...prev,
      {
        localKey: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        id: selectedProduct.id,
        name: selectedProduct.name,
        qty: customQty,
        price: selectedProduct.price ?? 0,
        additions: customAdds.slice(),
        notes: customNotes || undefined,
        status: "pending",
        cancelRequestStatus: "none",
      },
    ]);

    setMode("browse");
    setSelectedProduct(null);
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const requestCancel = async (orderItemId: string) => {
    try {
      await apiFetch(`/api/orders/items/${orderItemId}/cancel-request`, {
        method: "POST",
      });
      await reloadActiveOrder();
    } catch (e) {
      console.error("Cancel request failed", e);
      alert("Cancel request failed");
    }
  };

  const confirmOrder = async () => {
    if (!activeShift?.shiftId) {
      alert("No active shift.");
      return;
    }

    const pending = cart.filter((x) => x.status === "pending");
    if (!pending.length) {
      alert("No items to confirm.");
      return;
    }

    try {
      const body = {
        shiftId: activeShift.shiftId,
        tableNum: table !== "none" ? table : null,
        tableId,
        originStationId,
        orderId: orderId ?? null,
        items: pending.map((item) => ({
          productId: item.id,
          qty: item.qty,
          notes: item.notes ?? "",
          additions: item.additions,
        })),
        guestName: guestName || null,
        guestPhone: phone || null,
        dinersCount: diners ? Number(diners) : null,
        note: note || null,
      };

      const res = await apiFetch<{ orderId: string }>("/api/orders/confirm", {
        method: "POST",
        body,
      });

      setOrderId(res.orderId);
      const nextCart = cartRef.current.filter((x) => x.status !== "pending");
      cartRef.current = nextCart;
      setCart(nextCart);
      await reloadActiveOrder();
    } catch (e) {
      console.error("Confirm failed", e);
      alert("Confirm failed");
    }
  };

  const payAndClose = async () => {
    if (!orderId) {
      alert("Confirm the order first.");
      return;
    }
    setPaymentOpen(true);
  };

  const completePayment = async ({
    payments,
    totalBeforeTipCents,
    tipCents,
    totalCents,
  }: {
    payments: FinalizedPaymentLine[];
    totalBeforeTipCents: number;
    tipCents: number;
    totalCents: number;
  }) => {
    if (!orderId) {
      throw new Error("Order missing");
    }

    const closedAt = new Date().toISOString();

    await apiFetch(`/api/orders/${orderId}/payments`, {
      method: "PUT",
      body: { payments },
    });

    await apiFetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      body: {
        totalBeforeTipCents,
        tipCents,
        totalCents,
        paidCents: totalCents,
        paymentStatus: "paid",
        status: "closed",
        closedAt,
      },
    });

    cartRef.current = [];
    setCart([]);
    setOrderId(null);
    setPaymentOpen(false);
    setGuestName("");
    setPhone("");
    setDiners("");
    setNote("");
    setStartTime(new Date());
    setEndTime(null);
  };

  const topButtonLabel = hasPending ? "Confirm" : "Pay Now";
  const topButtonDisabled = hasPending ? cart.length === 0 : !hasFinalizedItems;
  const topButtonAction = hasPending ? confirmOrder : payAndClose;

  function CategorySidebar() {
    if (!path.length) {
      return (
        <div className="rs-surface p-4 text-sm text-[var(--muted-foreground)]">
          No menu.
        </div>
      );
    }

    const node = current!;
    const children = node.children ?? [];

    return (
      <PosPanel
        title={node.name ?? "Menu"}
        description="Category navigation"
        className="h-full"
        actions={<PosStatusPill>{children.length} sections</PosStatusPill>}
      >
          {children.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)]">No sub-categories.</div>
          ) : (
            <ul className="space-y-1">
              {children.map((child) => (
                <li key={child.id}>
                  <button
                    className="w-full rounded-[0.95rem] border border-transparent px-3 py-2.5 text-left text-[var(--foreground)] transition hover:border-[var(--border)] hover:bg-[var(--card-muted)]"
                    onClick={() => enterNode(child)}
                  >
                    {child.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {path.length > 1 ? (
            <button
              className="mt-3 w-full rounded-[0.95rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              onClick={goUpOne}
            >
              Up one
            </button>
          ) : null}
      </PosPanel>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-4 lg:px-6">
      <OrderInfoCard
        table={table}
        setTable={setTable}
        guestName={guestName}
        setGuestName={setGuestName}
        diners={diners}
        setDiners={setDiners}
        phone={phone}
        setPhone={setPhone}
        note={note}
        setNote={setNote}
        startTime={startTime ?? new Date()}
        endTime={endTime}
        minimum={minimum}
        total={total}
        totalWith10={totalWith10}
        only10={only10}
        topButtonLabel={topButtonLabel}
        topButtonDisabled={topButtonDisabled}
        onTopButtonClick={topButtonAction}
        hasConfirmedItems={hasFinalizedItems}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(300px,340px)]">
        <div className="xl:row-span-2 2xl:row-span-1">
          <OrderItems cart={cart} onRemove={removeCartItem} onRequestCancel={requestCancel} />
        </div>

        <div className="min-w-0">
          {mode === "details" && selectedProduct ? (
            <ItemDetails
              product={selectedProduct}
              qty={customQty}
              setQty={setCustomQty}
              notes={customNotes}
              setNotes={setCustomNotes}
              adds={customAdds}
              setAdds={setCustomAdds}
              onCancel={() => {
                setMode("browse");
                setSelectedProduct(null);
              }}
              onAdd={addToCart}
            />
          ) : (
            <OrderMenu
              path={path}
              current={current}
              products={products}
              onPickProduct={onPickProduct}
            />
          )}
        </div>

        <div className="min-w-0">
          <CategorySidebar />
        </div>
      </div>

      <PaymentScreen
        open={paymentOpen}
        subtotal={total}
        onClose={() => setPaymentOpen(false)}
        onComplete={completePayment}
      />
    </div>
  );
}
