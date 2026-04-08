import { type ReactNode, useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { ReceiptIcon, XIcon } from "../../components/icons";
import { PosActionStrip, PosMetricCircle, PosPanel, PosStatusPill } from "../../components/ui/pos";
import { formatMoney } from "../../utils/money";

type PaymentMethod = "cash" | "credit_card" | "company_card";
type TipMode = "percent" | "amount";
type CardEntryMode = "manual" | "scanner";

type PaymentCardDraft = {
  method: PaymentMethod | null;
  tipMode: TipMode;
  tipValue: string;
  receivedCents: number;
  cardEntryMode: CardEntryMode;
  acquirer: string;
  reference: string;
};

export type FinalizedPaymentLine = {
  splitIndex: number;
  method: PaymentMethod;
  baseAmountCents: number;
  tipCents: number;
  totalAmountCents: number;
  receivedCents?: number | null;
  changeCents?: number | null;
  cardEntryMode?: CardEntryMode | null;
  acquirer?: string | null;
  reference?: string | null;
};

type PaymentScreenProps = {
  open: boolean;
  subtotal: number;
  onClose: () => void;
  onComplete: (payload: {
    payments: FinalizedPaymentLine[];
    totalBeforeTipCents: number;
    tipCents: number;
    totalCents: number;
  }) => Promise<void>;
};

const SPLIT_OPTIONS = [1, 2, 3, 4, 5, 6];
const GLOBAL_TIP_PERCENT_OPTIONS = [0, 10, 12, 15];
const CARD_TIP_PERCENT_OPTIONS = [0, 10, 12, 15];
const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.1];
const ACQUIRER_OPTIONS = ["Beecom", "Tabit", "Other"];

function createEmptyCard(): PaymentCardDraft {
  return {
    method: null,
    tipMode: "amount",
    tipValue: "",
    receivedCents: 0,
    cardEntryMode: "manual",
    acquirer: "",
    reference: "",
  };
}

function splitCents(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function parseMoneyInput(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function tipToCents(mode: TipMode, value: string, baseCents: number): number {
  const amount = parseMoneyInput(value);
  if (amount <= 0) return 0;
  if (mode === "percent") return Math.round((baseCents * amount) / 100);
  return Math.round(amount * 100);
}

function formatMethod(method: PaymentMethod | null): string {
  switch (method) {
    case "cash":
      return "Cash";
    case "credit_card":
      return "Credit";
    case "company_card":
      return "Company";
    default:
      return "Select";
  }
}

export default function PaymentScreen({
  open,
  subtotal,
  onClose,
  onComplete,
}: PaymentScreenProps) {
  const subtotalCents = useMemo(() => Math.round(subtotal * 100), [subtotal]);

  const [splitCount, setSplitCount] = useState(1);
  const [cards, setCards] = useState<PaymentCardDraft[]>([createEmptyCard()]);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [globalTipOpen, setGlobalTipOpen] = useState(false);
  const [globalTipMode, setGlobalTipMode] = useState<TipMode>("percent");
  const [globalTipValue, setGlobalTipValue] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCards((prev) =>
      Array.from({ length: splitCount }, (_, index) => prev[index] ?? createEmptyCard())
    );
  }, [open, splitCount]);

  useEffect(() => {
    if (!open) return;
    setSplitCount(1);
    setCards([createEmptyCard()]);
    setSelectedCardIndex(null);
    setGlobalTipOpen(false);
    setGlobalTipMode("percent");
    setGlobalTipValue("0");
    setSaving(false);
  }, [open, subtotalCents]);

  const globalTipCents = useMemo(
    () => tipToCents(globalTipMode, globalTipValue, subtotalCents),
    [globalTipMode, globalTipValue, subtotalCents]
  );

  const baseShares = useMemo(() => splitCents(subtotalCents, splitCount), [splitCount, subtotalCents]);
  const globalTipShares = useMemo(
    () => splitCents(globalTipCents, splitCount),
    [globalTipCents, splitCount]
  );

  const cardSummaries = useMemo(() => {
    return cards.slice(0, splitCount).map((card, index) => {
      const baseAmountCents = baseShares[index] ?? 0;
      const sharedTipCents = globalTipShares[index] ?? 0;
      const extraTipCents = tipToCents(card.tipMode, card.tipValue, baseAmountCents);
      const tipCents = sharedTipCents + extraTipCents;
      const totalAmountCents = baseAmountCents + tipCents;
      const changeCents =
        card.method === "cash" ? Math.max(card.receivedCents - totalAmountCents, 0) : 0;
      const remainingCents =
        card.method === "cash" ? Math.max(totalAmountCents - card.receivedCents, 0) : 0;

      return {
        ...card,
        index,
        baseAmountCents,
        sharedTipCents,
        extraTipCents,
        tipCents,
        totalAmountCents,
        changeCents,
        remainingCents,
      };
    });
  }, [baseShares, cards, globalTipShares, splitCount]);

  const totalTipCents = useMemo(
    () => cardSummaries.reduce((sum, card) => sum + card.tipCents, 0),
    [cardSummaries]
  );

  const totalAmountCents = subtotalCents + totalTipCents;

  const canComplete = cardSummaries.length > 0 && cardSummaries.every((card) => {
    if (!card.method) return false;
    if (card.method === "cash") return card.receivedCents >= card.totalAmountCents;
    if (card.method === "credit_card") {
      if (!card.cardEntryMode) return false;
      if (card.cardEntryMode === "scanner" && !card.acquirer.trim()) return false;
    }
    return true;
  });

  const updateCard = (index: number, patch: Partial<PaymentCardDraft>) => {
    setCards((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addCashValue = (index: number, amount: number) => {
    setCards((prev) => {
      const next = prev.slice();
      const received = next[index]?.receivedCents ?? 0;
      next[index] = {
        ...next[index],
        receivedCents: received + Math.round(amount * 100),
      };
      return next;
    });
  };

  const finalize = async () => {
    if (!canComplete || saving) return;

    const payments = cardSummaries.map<FinalizedPaymentLine>((card) => ({
      splitIndex: card.index,
      method: card.method!,
      baseAmountCents: card.baseAmountCents,
      tipCents: card.tipCents,
      totalAmountCents: card.totalAmountCents,
      receivedCents: card.method === "cash" ? card.receivedCents : null,
      changeCents: card.method === "cash" ? card.changeCents : null,
      cardEntryMode: card.method === "credit_card" ? card.cardEntryMode : null,
      acquirer:
        card.method === "credit_card" && card.cardEntryMode === "scanner"
          ? card.acquirer.trim() || null
          : null,
      reference:
        card.method !== "cash" && card.reference.trim() ? card.reference.trim() : null,
    }));

    try {
      setSaving(true);
      await onComplete({
        payments,
        totalBeforeTipCents: subtotalCents,
        tipCents: totalTipCents,
        totalCents: totalAmountCents,
      });
    } catch (error) {
      console.error("Payment save failed", error);
      alert("Payment failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const selectedCard =
    selectedCardIndex != null ? cardSummaries[selectedCardIndex] ?? null : null;

  return (
    <>
      <div className="rs-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 lg:p-6">
        <div className="w-full max-w-6xl overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-main)] shadow-[var(--shadow-strong)]">
          <div className="rs-pos-topbar relative px-5 pb-5 pt-4 lg:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap gap-4 text-white/84">
                <HeaderMetric label="Paid" value={`NIS ${formatMoney(0)}`} />
                <HeaderMetric label="Split" value={`${splitCount} / ${splitCount}`} />
                <HeaderMetric label="Tip" value={`NIS ${formatMoney(globalTipCents / 100)}`} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="border-white/10 bg-white/8 text-white hover:bg-white/14 hover:text-white"
                  onClick={() => setGlobalTipOpen(true)}
                >
                  Add Tip
                </Button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/8 text-white transition hover:bg-white/14"
                >
                  <XIcon className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[18px] -translate-x-1/2">
              <PosMetricCircle label="Total" value={formatMoney(totalAmountCents / 100)} />
            </div>
          </div>

          <div className="px-5 pb-5 pt-20 lg:px-6">
            <PosActionStrip className="mb-5">
              {SPLIT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSplitCount(count)}
                  className={[
                    "rounded-[0.95rem] border px-3 py-2 text-sm font-medium transition",
                    splitCount === count
                      ? "border-[color:color-mix(in_srgb,var(--highlight)_70%,white_30%)] bg-[var(--highlight)] text-[var(--accent-foreground)]"
                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]",
                  ].join(" ")}
                >
                  Split {count}
                </button>
              ))}
              <PosStatusPill>Subtotal NIS {formatMoney(subtotalCents / 100)}</PosStatusPill>
              <PosStatusPill tone="accent">Tip NIS {formatMoney(globalTipCents / 100)}</PosStatusPill>
            </PosActionStrip>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cardSummaries.map((card) => (
                  <button
                    key={card.index}
                    type="button"
                    onClick={() => setSelectedCardIndex(card.index)}
                    className={[
                      "rounded-[26px] border p-5 text-left transition",
                      selectedCardIndex === card.index
                        ? "border-[var(--accent)] bg-[var(--card)]"
                        : "border-[var(--border)] bg-[var(--card-muted)] hover:bg-[var(--muted)]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Card {card.index + 1}
                        </div>
                        <div className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                          NIS {formatMoney(card.totalAmountCents / 100)}
                        </div>
                      </div>
                      <div
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          card.method
                            ? "bg-[var(--success-surface)] text-[var(--success)]"
                            : "bg-[var(--warning-surface)] text-[var(--warning)]",
                        ].join(" ")}
                      >
                        {formatMethod(card.method)}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-[var(--muted-foreground)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>Bill</span>
                        <span className="text-[var(--foreground)]">
                          NIS {formatMoney(card.baseAmountCents / 100)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Tip</span>
                        <span className="text-[var(--foreground)]">
                          NIS {formatMoney(card.tipCents / 100)}
                        </span>
                      </div>
                      {card.method === "cash" ? (
                        <div className="flex items-center justify-between gap-3">
                          <span>Change</span>
                          <span className="text-[var(--foreground)]">
                            NIS {formatMoney(card.changeCents / 100)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <PosPanel title="Summary" description={`${splitCount} payment ${splitCount === 1 ? "card" : "cards"}`} tone="highlight">
              <div className="space-y-3">
                <SummaryRow label="Subtotal" value={`NIS ${formatMoney(subtotalCents / 100)}`} />
                <SummaryRow label="Tip" value={`NIS ${formatMoney(totalTipCents / 100)}`} />
                <SummaryRow label="Total" value={`NIS ${formatMoney(totalAmountCents / 100)}`} strong />
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={finalize} disabled={!canComplete || saving}>
                  {saving ? "Saving..." : "Complete payment"}
                </Button>
                <Button variant="secondary" onClick={onClose} disabled={saving}>
                  Close
                </Button>
              </div>
            </PosPanel>
          </div>
        </div>
      </div>
      </div>

      {globalTipOpen ? (
        <div className="rs-overlay fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="rs-modal w-full max-w-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-[var(--foreground)]">Global tip</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  Apply once across all cards.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGlobalTipOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <ModeButton
                active={globalTipMode === "percent"}
                onClick={() => setGlobalTipMode("percent")}
              >
                Percent
              </ModeButton>
              <ModeButton
                active={globalTipMode === "amount"}
                onClick={() => setGlobalTipMode("amount")}
              >
                Amount
              </ModeButton>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                {globalTipMode === "percent" ? "Percent" : "Amount"}
              </label>
              <input
                className="rs-input"
                value={globalTipValue}
                onChange={(e) => setGlobalTipValue(e.target.value)}
                placeholder={globalTipMode === "percent" ? "10" : "20"}
              />
            </div>

            {globalTipMode === "percent" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {GLOBAL_TIP_PERCENT_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGlobalTipValue(String(value))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card-muted)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                  >
                    {value}%
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setGlobalTipOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCard ? (
        <div className="rs-overlay fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="rs-modal w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-[var(--foreground)]">
                  Card {selectedCard.index + 1}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  NIS {formatMoney(selectedCard.totalAmountCents / 100)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardIndex(null)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-[var(--border)] bg-[var(--card-muted)] px-5 py-4">
              <div className="grid gap-2 sm:grid-cols-4">
                <MethodButton
                  active={selectedCard.method === "credit_card"}
                  onClick={() =>
                    updateCard(selectedCard.index, {
                      method: "credit_card",
                      receivedCents: 0,
                    })
                  }
                >
                  Credit card
                </MethodButton>
                <MethodButton
                  active={selectedCard.method === "company_card"}
                  onClick={() =>
                    updateCard(selectedCard.index, {
                      method: "company_card",
                      receivedCents: 0,
                    })
                  }
                >
                  Company card
                </MethodButton>
                <MethodButton
                  active={selectedCard.method === "cash"}
                  onClick={() =>
                    updateCard(selectedCard.index, {
                      method: "cash",
                    })
                  }
                >
                  Cash
                </MethodButton>
                <MethodButton active={false} onClick={() => setSelectedCardIndex(null)}>
                  Cancel
                </MethodButton>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  {selectedCard.method === "cash" ? (
                    <div className="space-y-5">
                      <TipEditor
                        mode={selectedCard.tipMode}
                        value={selectedCard.tipValue}
                        onModeChange={(mode) => updateCard(selectedCard.index, { tipMode: mode })}
                        onValueChange={(value) => updateCard(selectedCard.index, { tipValue: value })}
                      />

                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          Cash received
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                            Counter
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                            NIS {formatMoney(selectedCard.receivedCents / 100)}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {CASH_DENOMINATIONS.map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              onClick={() => addCashValue(selectedCard.index, amount)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left transition hover:bg-[var(--muted)]"
                            >
                              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                                Add
                              </div>
                              <div className="mt-1 font-medium text-[var(--foreground)]">
                                {amount}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              updateCard(selectedCard.index, {
                                receivedCents: selectedCard.totalAmountCents,
                              })
                            }
                          >
                            Exact
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => updateCard(selectedCard.index, { receivedCents: 0 })}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : selectedCard.method === "credit_card" ? (
                    <div className="space-y-5">
                      <TipEditor
                        mode={selectedCard.tipMode}
                        value={selectedCard.tipValue}
                        onModeChange={(mode) => updateCard(selectedCard.index, { tipMode: mode })}
                        onValueChange={(value) => updateCard(selectedCard.index, { tipValue: value })}
                      />

                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          Card entry
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ModeButton
                            active={selectedCard.cardEntryMode === "manual"}
                            onClick={() =>
                              updateCard(selectedCard.index, {
                                cardEntryMode: "manual",
                                acquirer: "",
                              })
                            }
                          >
                            Manual
                          </ModeButton>
                          <ModeButton
                            active={selectedCard.cardEntryMode === "scanner"}
                            onClick={() =>
                              updateCard(selectedCard.index, {
                                cardEntryMode: "scanner",
                              })
                            }
                          >
                            Scanner
                          </ModeButton>
                        </div>
                      </div>

                      {selectedCard.cardEntryMode === "scanner" ? (
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                            Acquirer
                          </span>
                          <select
                            className="rs-select"
                            value={selectedCard.acquirer}
                            onChange={(e) =>
                              updateCard(selectedCard.index, { acquirer: e.target.value })
                            }
                          >
                            <option value="">Select...</option>
                            {ACQUIRER_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Reference
                        </span>
                        <input
                          className="rs-input"
                          value={selectedCard.reference}
                          onChange={(e) =>
                            updateCard(selectedCard.index, { reference: e.target.value })
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  ) : selectedCard.method === "company_card" ? (
                    <div className="space-y-5">
                      <TipEditor
                        mode={selectedCard.tipMode}
                        value={selectedCard.tipValue}
                        onModeChange={(mode) => updateCard(selectedCard.index, { tipMode: mode })}
                        onValueChange={(value) => updateCard(selectedCard.index, { tipValue: value })}
                      />

                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Reference
                        </span>
                        <input
                          className="rs-input"
                          value={selectedCard.reference}
                          onChange={(e) =>
                            updateCard(selectedCard.index, { reference: e.target.value })
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card-muted)] px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
                      Select a payment method.
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
                  <div className="space-y-3">
                    <SummaryRow
                      label="Bill"
                      value={`NIS ${formatMoney(selectedCard.baseAmountCents / 100)}`}
                    />
                    <SummaryRow
                      label="Global tip"
                      value={`NIS ${formatMoney(selectedCard.sharedTipCents / 100)}`}
                    />
                    <SummaryRow
                      label="Card tip"
                      value={`NIS ${formatMoney(selectedCard.extraTipCents / 100)}`}
                    />
                    <SummaryRow
                      label="Due"
                      value={`NIS ${formatMoney(selectedCard.totalAmountCents / 100)}`}
                      strong
                    />
                    {selectedCard.method === "cash" ? (
                      <>
                        <SummaryRow
                          label="Received"
                          value={`NIS ${formatMoney(selectedCard.receivedCents / 100)}`}
                        />
                        <SummaryRow
                          label="Change"
                          value={`NIS ${formatMoney(selectedCard.changeCents / 100)}`}
                        />
                        <SummaryRow
                          label="Left"
                          value={`NIS ${formatMoney(selectedCard.remainingCents / 100)}`}
                        />
                      </>
                    ) : null}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" onClick={() => setSelectedCardIndex(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TipEditor({
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  mode: TipMode;
  value: string;
  onModeChange: (mode: TipMode) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
      <div className="text-sm font-semibold text-[var(--foreground)]">Tip</div>
      <div className="mt-3 flex gap-2">
        <ModeButton active={mode === "percent"} onClick={() => onModeChange("percent")}>
          Percent
        </ModeButton>
        <ModeButton active={mode === "amount"} onClick={() => onModeChange("amount")}>
          Amount
        </ModeButton>
      </div>

      <div className="mt-3 space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          {mode === "percent" ? "Percent" : "Amount"}
        </label>
        <input
          className="rs-input"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={mode === "percent" ? "10" : "20"}
        />
      </div>

      {mode === "percent" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {CARD_TIP_PERCENT_OPTIONS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => onValueChange(String(percent))}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            >
              {percent}%
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[78px] flex-col items-center justify-center">
      <span className="text-sm font-light leading-none">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/48">
        {label}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <span className={strong ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]"}>
        {value}
      </span>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MethodButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-3 text-sm font-medium transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
