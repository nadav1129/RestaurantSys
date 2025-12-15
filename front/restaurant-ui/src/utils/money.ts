// src/utils/money.ts
export const moneyFmt = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return moneyFmt.format(n);
}

/* Safety: if backend accidentally sends cents (1900) */
export function normalizeMoney(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0;
  if (Number.isInteger(raw) && raw >= 100) return raw / 100;
  return raw;
}
