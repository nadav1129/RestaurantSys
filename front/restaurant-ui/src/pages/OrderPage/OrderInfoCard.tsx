import { useState } from "react";
import Button from "../../components/Button";
import {
  ClockIcon,
  OrdersIcon,
  ReceiptIcon,
  TableIcon,
} from "../../components/icons";

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
      <div className="rs-surface p-5 lg:p-6">
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_320px]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:max-w-[420px] sm:grid-cols-[minmax(180px,1fr)_minmax(120px,150px)]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Table
                </span>
                <input
                  className="rs-input"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  placeholder="none"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Diners
                </span>
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
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Guest
                </span>
                <button
                  type="button"
                  onClick={openGuestEditor}
                  className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 text-left transition hover:bg-[var(--muted)]"
                >
                  <div>
                    <div className="font-medium text-[var(--foreground)]">
                      {displayName}
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {displayPhone}
                    </div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Edit
                  </div>
                </button>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Notes
                </span>
                <textarea
                  className="rs-textarea min-h-[120px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Birthday, allergy, special request..."
                />
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <OrdersIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Order Summary
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  Totals update from the existing cart logic.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rs-pill">
                <TableIcon className="h-4 w-4" />
                Table {table || "--"}
              </div>
              <div className="rs-pill">
                <ClockIcon className="h-4 w-4" />
                Start {formatTime(startTime)}
              </div>
              <div className="rs-pill">End {formatTime(endTime)}</div>
            </div>

            <div className="grid gap-3">
              <SummaryLine label="Minimum" value={`NIS ${formatMoney(minimum)}`} />
              <SummaryLine label="Total" value={`NIS ${formatMoney(total)}`} />
              <SummaryLine
                label="Total + 10%"
                value={`NIS ${formatMoney(totalWith10)}`}
                strong
              />
              <SummaryLine label="Only 10%" value={`NIS ${formatMoney(only10)}`} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => window.print()}
                disabled={!hasConfirmedItems}
              >
                <ReceiptIcon className="h-4 w-4" />
                Print receipt
              </Button>

              <Button onClick={onTopButtonClick} disabled={topButtonDisabled}>
                {topButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showGuestEditor && (
        <div className="rs-overlay fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="rs-modal w-full max-w-sm p-5">
            <div className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              Guest details
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Name
                </label>
                <input
                  className="rs-input"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Guest name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Phone
                </label>
                <input
                  className="rs-input"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  placeholder="050-0000000"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowGuestEditor(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveGuestEditor}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </>
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
    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <span
        className={[
          "text-sm",
          strong
            ? "font-semibold text-[var(--foreground)]"
            : "font-medium text-[var(--foreground)]",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
