import React, { useState } from "react";
import Button from "../../components/Button";

function formatTime(d: Date | null): string {
  if (!d) return "--:--";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* Format 19.00 -> 19, 19.50 -> 19.5 */
function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return n.toFixed(2).replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

type OrderInfoCardProps = {
  table: string;
  setTable: (value: string) => void;

  tableId: string | null;
  setTableId: (value: string | null) => void;

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

  topButtonLabel: string;          /* "Confirm" when pending exists, else "Pay Now" */
  topButtonDisabled?: boolean;
  onTopButtonClick: () => void;

  hasConfirmedItems: boolean;      /* for Print */
};

export default function OrderInfoCard({
  table,
  setTable,
  tableId,
  setTableId,
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
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-stretch md:justify-between">
        {/* Left: info section (top row + guest/phone + notes) */}
        <div className="flex flex-1 flex-col gap-3">
          {/* Top line: Table, Diners, Start, End */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Table */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Table</span>
              <input
                className="w-24 rounded-xl border border-gray-300 px-3 py-1 text-sm"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="none"
              />
              <input
                className="w-[22rem] max-w-[50vw] rounded-xl border border-gray-300 px-3 py-1 text-xs"
                value={tableId ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setTableId(v.length ? v : null);
                }}
                placeholder="tableId (GUID)"
                title="Real tableId (GUID). Used for persisting the open order."
              />
            </div>

            {/* Diners */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Diners</span>
              <input
                type="number"
                min={1}
                className="w-20 rounded-xl border border-gray-300 px-2 py-1 text-sm"
                value={diners}
                onChange={(e) => setDiners(e.target.value)}
                placeholder="2"
              />
            </div>

            {/* Start time */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Start</span>
              <span className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1">
                {formatTime(startTime)}
              </span>
            </div>

            {/* End time */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">End</span>
              <span className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1">
                {formatTime(endTime)}
              </span>
            </div>
          </div>

          {/* Name + Phone combined */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Guest</label>
            <button
              type="button"
              onClick={openGuestEditor}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-gray-400 hover:bg-gray-50"
            >
              {displayName} — {displayPhone}
            </button>
          </div>

          {/* Notes - big area */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <textarea
              className="min-h-[90px] w-full rounded-xl border border-gray-300 p-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Birthday, allergy, special request..."
            />
          </div>
        </div>

        {/* Right: totals + Print + Confirm/Pay anchored to bottom */}
        <div className="mt-2 flex w-full max-w-xs flex-col justify-between text-sm md:mt-0 md:self-stretch">
          {/* Totals text */}
          <div className="space-y-1 text-right">
            <div>
              <span className="text-gray-500">Minimum: </span>
              <span className="font-medium">₪{formatMoney(minimum)}</span>
            </div>
            <div>
              <span className="text-gray-500">Total: </span>
              <span className="font-medium">₪{formatMoney(total)}</span>
            </div>
            <div>
              <span className="text-gray-500">Total + 10%: </span>
              <span className="font-semibold">₪{formatMoney(totalWith10)}</span>
            </div>
            <div>
              <span className="text-gray-500">Only 10%: </span>
              <span className="font-medium">₪{formatMoney(only10)}</span>
            </div>
          </div>

          {/* Buttons row at the bottom, same size */}
          <div className="mt-4 flex w-full justify-end">
            <div className="flex w-full gap-2">
              <Button
                variant="secondary"
                onClick={() => window.print()}
                disabled={!hasConfirmedItems}
                className="flex-1 justify-center"
              >
                Print recite
              </Button>

              <Button
                onClick={onTopButtonClick}
                disabled={topButtonDisabled}
                className="flex-1 justify-center"
              >
                {topButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Popup for editing Name + Phone */}
      {showGuestEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-3 text-sm font-semibold text-gray-800">
              Guest details
            </div>
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">
                  Name
                </label>
                <input
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Guest name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">
                  Phone
                </label>
                <input
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  placeholder="050-0000000"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGuestEditor(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveGuestEditor}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
