import React, { useMemo, useState } from "react";
import {
  Home,
  BookOpen,
  Newspaper,
  Menu,
  Table2,
  Funnel,
  Zap,
  Users,
  Calculator,
  Printer,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Receipt,
  Wallet,
  Banknote,
  Trash2,
  X,
} from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

type ScreenKey = "home" | "paymentSelection" | "cashPayment" | "cardPayment";

type TopBarMode = "library" | "payment";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[78px] flex-col items-center justify-center text-white/85">
      <span className="text-[13px] font-light leading-none md:text-[16px]">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/45 md:text-[11px]">
        {label}
      </span>
    </div>
  );
}

function LibraryTopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    { key: "menu", label: "Menu", icon: Table2 },
    { key: "bookmarks", label: "Saved", icon: BookOpen },
    { key: "updates", label: "Updates", icon: Newspaper },
  ];

  return (
    <div className="bg-gradient-to-b from-[#6b6b71] to-[#5f6066] px-4 pb-2 pt-3 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <div className="mb-3 flex items-start justify-between">
        <div className="text-left leading-tight text-white/80">
          <div className="text-sm font-light">09:42 AM</div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">April 7</div>
        </div>

        <div className="pt-1 text-center text-lg font-medium tracking-wide">Main Screen</div>

        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-cyan-300 transition hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-cyan-300 transition hover:bg-white/10"
            >
              <Icon className="h-6 w-6" strokeWidth={1.8} />
              <span className="text-xs font-medium tracking-wide md:text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LibraryActionBar() {
  return (
    <div className="border-b border-neutral-200 bg-white px-3 py-3">
      <div className="grid grid-cols-5 gap-2 text-center text-neutral-500">
        <button className="flex flex-col items-center gap-1 rounded-md py-1 hover:bg-neutral-50">
          <div className="text-lg">⋯</div>
          <span className="text-[11px] md:text-xs">More Actions</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-md py-1 opacity-45">
          <Users className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[11px] md:text-xs">Split Guests</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-md py-1 hover:bg-neutral-50">
          <Zap className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[11px] md:text-xs">Quick Invite</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-md py-1 hover:bg-neutral-50">
          <Table2 className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[11px] md:text-xs">Open Tables</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-md py-1 hover:bg-neutral-50">
          <Funnel className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[11px] md:text-xs">Filter</span>
        </button>
      </div>
    </div>
  );
}

function PaymentTopBar({ total }: { total: number }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#6e6f76] to-[#5c5d63] px-4 pb-4 pt-3 text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between">
        <div className="flex gap-4 md:gap-6">
          <Metric label="Service" value="0%" />
          <Metric label="Discount" value="0%" />
          <Metric label="Split" value="1 / 1" />
          <div className="flex min-w-[78px] flex-col items-center justify-center text-white/85">
            <Users className="mb-1 h-5 w-5" strokeWidth={1.6} />
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/45 md:text-[11px]">
              Diners
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5 pr-10 text-white/80 md:gap-7">
          <div className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.16em]">
            <Calculator className="h-5 w-5" strokeWidth={1.6} />
            <span>Calculator</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.16em]">
            <Printer className="h-5 w-5" strokeWidth={1.6} />
            <span>Print</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[78px] border-t-[78px] border-l-transparent border-t-cyan-400/95">
        <ArrowRight className="absolute right-3 top-[-66px] h-5 w-5 text-white" strokeWidth={2} />
      </div>

      <div className="absolute left-1/2 top-[18px] -translate-x-1/2">
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#77777d] text-center shadow-[0_10px_20px_rgba(0,0,0,0.12)] ring-1 ring-white/15">
          <div className="text-[34px] font-light leading-none">{total.toFixed(1)}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/70">Total</div>
        </div>
      </div>
    </div>
  );
}

function PaymentProgress({ total }: { total: number }) {
  const points = useMemo(
    () => [
      { label: "Paid", value: "$0", color: "bg-sky-500" },
      { label: "Subtotal", value: currency.format(total), color: "bg-rose-500" },
      { label: "Service", value: "$0", color: "bg-lime-500" },
      { label: "Discount", value: "$0", color: "bg-slate-500" },
      { label: "To Pay", value: currency.format(total), color: "bg-cyan-400" },
    ],
    [total]
  );

  return (
    <div className="mt-auto px-6 pb-6 pt-8">
      <div className="relative mx-auto max-w-5xl">
        <div className="absolute left-0 right-0 top-[48px] h-[2px] bg-orange-300" />

        <div className="grid grid-cols-5 gap-2 text-center text-neutral-500">
          {points.map((point) => (
            <div key={point.label} className="relative">
              <div className="mb-6 text-[11px] uppercase tracking-[0.14em] text-neutral-500 md:text-xs">
                <div>{point.label}</div>
                <div className="mt-1 text-sm tracking-normal text-neutral-400">{point.value}</div>
              </div>
              <div className={`relative z-10 mx-auto h-4 w-4 rounded-full ${point.color} ring-4 ring-white`} />
            </div>
          ))}
        </div>

        <button className="absolute left-[-8px] top-[39px] flex h-9 w-9 items-center justify-center rounded-full bg-[#6a6a70] text-orange-300 shadow-md">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button className="absolute right-[-8px] top-[39px] flex h-9 w-9 items-center justify-center rounded-full bg-[#6a6a70] text-orange-300 shadow-md">
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-sm text-neutral-500">
        <span>Finish & close order</span>
        <span>Return to order</span>
      </div>
    </div>
  );
}

function PaymentSelectionScreen({
  onCash,
  onCard,
}: {
  onCash: () => void;
  onCard: () => void;
}) {
  const items = [
    { label: "Voucher", icon: Receipt, disabled: true },
    { label: "Quick Cash", icon: Banknote, disabled: true },
    { label: "Cash", icon: Wallet, onClick: onCash },
    { label: "Credit Card", icon: CreditCard, onClick: onCard },
  ];

  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col bg-[#f7f7f6] px-6 pt-20">
      <div className="mx-auto w-full max-w-5xl text-center">
        <div className="mb-14 text-3xl font-light tracking-wide text-neutral-500">Quick Payment</div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={item.onClick}
                className="group flex flex-col items-center gap-4 disabled:cursor-default disabled:opacity-85"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#87888c] text-white shadow-sm transition group-hover:scale-105 group-disabled:group-hover:scale-100">
                  <Icon className="h-9 w-9" strokeWidth={1.6} />
                </div>
                <span className="text-lg font-light tracking-wide text-neutral-500">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CashPaymentScreen({ onBack }: { onBack: () => void }) {
  const values = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];

  return (
    <div className="min-h-[calc(100vh-220px)] bg-[#f7f7f6] px-6 py-10">
      <div className="mx-auto max-w-4xl overflow-hidden border border-neutral-200 bg-white shadow-sm">
        <div className="grid grid-cols-[90px_90px_1fr_1fr_160px] items-center border-b border-neutral-200 text-neutral-400">
          <button className="flex h-16 items-center justify-center border-r border-neutral-200 text-neutral-400 hover:bg-neutral-50">
            <X className="h-8 w-8" strokeWidth={1.4} />
          </button>
          <button className="flex h-16 items-center justify-center border-r border-neutral-200 text-neutral-400 hover:bg-neutral-50">
            <Trash2 className="h-8 w-8" strokeWidth={1.4} />
          </button>
          <div className="px-4 text-center text-lg font-light text-indigo-700">Service 0%</div>
          <div className="px-4 text-center text-lg font-light text-indigo-700">To Pay {currency.format(42)}</div>
          <div className="px-4 text-right text-3xl font-light text-neutral-500">Cash</div>
        </div>

        <div className="border-b border-neutral-200 px-6 py-6 text-center text-xl font-light text-indigo-700">
          Choose details / denominations for payment
        </div>

        <div className="grid grid-cols-[90px_1fr_180px] border-b border-neutral-200">
          <div className="flex items-center justify-center border-r border-neutral-200 p-4 text-neutral-500">
            <Calculator className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <div className="flex items-center justify-center border-r border-neutral-200 p-4 text-5xl font-extralight text-neutral-500">
            0
          </div>
          <div className="flex items-center justify-center p-4 text-4xl font-extralight text-neutral-400">Accepted</div>
        </div>

        <div className="grid grid-cols-5 gap-y-8 px-8 py-8 text-center text-neutral-500 md:grid-cols-10">
          {values.map((value) => (
            <div key={value} className="flex flex-col items-center gap-3">
              <div className="text-lg font-light">{value < 1 ? `${value}` : value}</div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-neutral-300 bg-neutral-50 text-neutral-500">
                {value < 20 ? <div className="text-3xl">◔</div> : <div className="text-2xl">▤</div>}
              </div>
              <button className="h-10 w-10 rounded-full border border-neutral-300 bg-white transition hover:bg-neutral-50" />
            </div>
          ))}
        </div>

        <button
          onClick={onBack}
          className="w-full border-t border-neutral-200 py-5 text-center text-3xl font-extralight text-neutral-400 transition hover:bg-neutral-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function CardPaymentScreen() {
  return (
    <div className="min-h-[calc(100vh-220px)] bg-[#f7f7f6] px-6 py-10">
      <div className="mx-auto max-w-4xl overflow-hidden border border-neutral-200 bg-white shadow-sm">
        <div className="grid grid-cols-[90px_90px_1fr_1fr_160px] items-center border-b border-neutral-200 text-neutral-400">
          <button className="flex h-16 items-center justify-center border-r border-neutral-200 text-neutral-400 hover:bg-neutral-50">
            <X className="h-8 w-8" strokeWidth={1.4} />
          </button>
          <button className="flex h-16 items-center justify-center border-r border-neutral-200 text-neutral-400 hover:bg-neutral-50">
            <Trash2 className="h-8 w-8" strokeWidth={1.4} />
          </button>
          <div className="px-4 text-center text-lg font-light text-indigo-700">Service 0%</div>
          <div className="px-4 text-center text-lg font-light text-indigo-700">To Pay {currency.format(42)}</div>
          <div className="px-4 text-right text-3xl font-light text-neutral-500">Credit Card</div>
        </div>

        <div className="border-b border-neutral-200 px-6 py-6 text-center text-xl font-light text-indigo-700">
          Choose payment type
        </div>

        <div className="grid grid-cols-2">
          <button className="flex flex-col items-center justify-center gap-4 border-r border-neutral-200 px-6 py-10 transition hover:bg-neutral-50">
            <Receipt className="h-16 w-16 text-neutral-500" strokeWidth={1.5} />
            <span className="text-3xl font-extralight text-neutral-500">Manual</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-4 px-6 py-10 transition hover:bg-neutral-50">
            <Calculator className="h-16 w-16 text-neutral-500" strokeWidth={1.5} />
            <span className="text-3xl font-extralight text-neutral-500">Terminal</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptySavedScreen({ onStartPayment }: { onStartPayment: () => void }) {
  return (
    <div className="relative min-h-[calc(100vh-170px)] bg-white">
      <div className="absolute left-0 top-48 flex h-20 w-14 items-center justify-center rounded-r-xl bg-[#4b4d50] text-lime-400 shadow-md">
        <div className="text-2xl">◔</div>
      </div>

      <div className="flex h-full min-h-[calc(100vh-170px)] flex-col items-center justify-start px-6 pt-28 text-center">
        <div className="mb-3 text-[44px] text-neutral-300">🔖</div>
        <div className="text-3xl font-light text-neutral-500">No open invitations</div>
        <button
          onClick={onStartPayment}
          className="mt-10 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition hover:bg-cyan-500"
        >
          Open Payment Demo
        </button>
      </div>
    </div>
  );
}

export default function RestaurantPosReplica() {
  const [screen, setScreen] = useState<ScreenKey>("home");

  const topBarMode: TopBarMode = screen === "home" ? "library" : "payment";

  return (
    <div className="min-h-screen bg-neutral-200 p-4 md:p-8">
      <div className="mx-auto max-w-md overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.22)] md:max-w-5xl">
        {topBarMode === "library" ? <LibraryTopBar /> : <PaymentTopBar total={42} />}

        {screen === "home" && <LibraryActionBar />}

        {screen === "home" && <EmptySavedScreen onStartPayment={() => setScreen("paymentSelection")} />}

        {screen === "paymentSelection" && (
          <>
            <PaymentSelectionScreen
              onCash={() => setScreen("cashPayment")}
              onCard={() => setScreen("cardPayment")}
            />
            <PaymentProgress total={42} />
          </>
        )}

        {screen === "cashPayment" && <CashPaymentScreen onBack={() => setScreen("paymentSelection")} />}

        {screen === "cardPayment" && <CardPaymentScreen />}
      </div>

      <div className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setScreen("home")}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        >
          Saved / Home Screen
        </button>
        <button
          onClick={() => setScreen("paymentSelection")}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        >
          Payment Selection
        </button>
        <button
          onClick={() => setScreen("cashPayment")}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        >
          Cash Payment
        </button>
        <button
          onClick={() => setScreen("cardPayment")}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        >
          Card Payment
        </button>
      </div>
    </div>
  );
}
