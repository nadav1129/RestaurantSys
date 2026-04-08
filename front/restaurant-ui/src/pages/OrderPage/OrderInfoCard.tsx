import { useState } from "react";
import Button from "../../components/Button";
import { ClockIcon, OrdersIcon, ReceiptIcon, TableIcon } from "../../components/icons";
import { PosActionStrip, PosMetricCircle, PosPanel, PosStatusPill } from "../../components/ui/pos";

function formatTime(d: Date | null): string {
  if (!d) return "--:--";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return n.toFixed(2).replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

type OrderInfoCardProps = {
  table: string;
  setTable: (value: string) => void;
  guestName: string;
  setGuestName: (value: string) => void;
  diners: string;
  setDiners: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  startTime: Date | null;
  endTime: Date | null;
  minimum: number;
  total: number;
  totalWith10: number;
  only10: number;
  topButtonLabel: string;
  topButtonDisabled?: boolean;
  onTopButtonClick: () => void;
  hasConfirmedItems: boolean;
};

export default function OrderInfoCard({
  table,
  setTable,
  guestName,
  setGuestName,
  diners,
  setDiners,
  phone,
  setPhone,
  note,
  setNote,
  startTime,
  endTime,
  minimum,
  total,
  totalWith10,
  only10,
  topButtonLabel,
  topButtonDisabled = false,
  onTopButtonClick,
  hasConfirmedItems,
}: OrderInfoCardProps) {
  const [showGuestEditor, setShowGuestEditor] = useState(false);
  const [tempName, setTempName] = useState(guestName);
  const [tempPhone, setTempPhone] = useState(phone);

  const openGuestEditor = () => {
    setTempName(guestName);
    setTempPhone(phone);
    setShowGuestEditor(true);
  };

  const saveGuestEditor = () => {
    setGuestName(tempName.trim());
    setPhone(tempPhone.trim());
    setShowGuestEditor(false);
  };

  const displayName = guestName.trim() || "Guest name";
  const displayPhone = phone.trim() || "Phone";

  return (
    <>
      <div className="overflow-hidden rounded-[1.3rem] border border-[var(--border)] shadow-[var(--shadow-soft)]">
        <div className="rs-pos-topbar relative px-5 pb-5 pt-4 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap gap-3 text-white/85">
              <TopMetric label="Table" value={table || "--"} />
              <TopMetric label="Diners" value={diners || "--"} />
              <TopMetric label="Start" value={formatTime(startTime)} />
              <TopMetric label="End" value={formatTime(endTime)} />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="border-white/10 bg-white/8 text-white hover:bg-white/14 hover:text-white"
                onClick={() => window.print()}
                disabled={!hasConfirmedItems}
              >
                <ReceiptIcon className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={onTopButtonClick} disabled={topButtonDisabled}>
                {topButtonLabel}
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-[18px] -translate-x-1/2">
            <PosMetricCircle label="Total" value={formatMoney(total)} />
          </div>
        </div>

        <div className="bg-[var(--surface-main)] px-5 pb-5 pt-20 lg:px-6">
          <PosActionStrip className="mb-5">
            <PosStatusPill tone="accent">
              <TableIcon className="h-4 w-4" />
              Table {table || "--"}
            </PosStatusPill>
            <PosStatusPill>
              <OrdersIcon className="h-4 w-4" />
              Live order
            </PosStatusPill>
            <PosStatusPill>
              <ClockIcon className="h-4 w-4" />
              Started {formatTime(startTime)}
            </PosStatusPill>
          </PosActionStrip>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
            <div className="grid gap-5">
              <div className="grid gap-4 sm:max-w-[420px] sm:grid-cols-[minmax(180px,1fr)_minmax(140px,160px)]">
                <label className="space-y-2">
                  <span className="rs-pos-section-kicker">Table</span>
                  <input
                    className="rs-input"
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    placeholder="none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="rs-pos-section-kicker">Diners</span>
                  <input
                    type="number"
                    min={1}
                    className="rs-input"
                    value={diners}
                    onChange={(e) => setDiners(e.target.value)}
                    placeholder="2"
                  />
                </label>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
                <PosPanel
                  title="Guest"
                  description="Guest details stay editable without changing the order flow."
                  tone="soft"
                  actions={
                    <Button variant="secondary" onClick={openGuestEditor}>
                      Edit
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    <div className="text-lg font-semibold text-[var(--foreground)]">
                      {displayName}
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)]">{displayPhone}</div>
                  </div>
                </PosPanel>

                <label className="space-y-2">
                  <span className="rs-pos-section-kicker">Notes</span>
                  <textarea
                    className="rs-textarea min-h-[146px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Birthday, allergy, special request..."
                  />
                </label>
              </div>
            </div>

            <PosPanel
              title="Summary"
              description="Payment-ready totals from the existing cart logic."
              tone="highlight"
            >
              <div className="space-y-3">
                <SummaryLine label="Minimum" value={`NIS ${formatMoney(minimum)}`} />
                <SummaryLine label="Subtotal" value={`NIS ${formatMoney(total)}`} />
                <SummaryLine
                  label="Service 10%"
                  value={`NIS ${formatMoney(only10)}`}
                />
                <SummaryLine
                  label="Total + 10%"
                  value={`NIS ${formatMoney(totalWith10)}`}
                  strong
                />
              </div>
            </PosPanel>
          </div>
        </div>
      </div>

      {showGuestEditor ? (
        <div className="rs-overlay fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="rs-modal w-full max-w-sm p-5">
            <div className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              Guest details
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="rs-pos-section-kicker">Name</label>
                <input
                  className="rs-input"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Guest name"
                />
              </div>
              <div className="space-y-2">
                <label className="rs-pos-section-kicker">Phone</label>
                <input
                  className="rs-input"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  placeholder="050-0000000"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowGuestEditor(false)}>
                Cancel
              </Button>
              <Button onClick={saveGuestEditor}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[74px] flex-col items-center justify-center">
      <span className="text-sm font-light leading-none">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/48">
        {label}
      </span>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[0.95rem] border border-[var(--border)] bg-white/72 px-4 py-3">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <span className={strong ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]"}>
        {value}
      </span>
    </div>
  );
}
