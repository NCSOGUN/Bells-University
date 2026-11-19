// Ballpark figures for family paying from abroad (UX Addendum §2C). These are
// fixed, indicative values, not live rates, the screen says so.

export type ForeignCurrency = "GBP" | "USD";

/** Naira per unit of foreign currency. */
export const INDICATIVE_NGN_PER: Record<ForeignCurrency, number> = {
  GBP: 2050,
  USD: 1530,
};

/** Estimated card fee for payments made with a card issued outside Nigeria. */
export const CROSS_BORDER_FEE = { percent: 3.9, flatNGN: 100 } as const;

export function crossBorderFeeNGN(amountNGN: number): number {
  return Math.round((amountNGN * CROSS_BORDER_FEE.percent) / 100 + CROSS_BORDER_FEE.flatNGN);
}

export function toForeign(amountNGN: number, currency: ForeignCurrency): number {
  return amountNGN / INDICATIVE_NGN_PER[currency];
}

const FOREIGN_FORMAT: Record<ForeignCurrency, Intl.NumberFormat> = {
  GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};

/** "£15.25" */
export function formatForeign(amount: number, currency: ForeignCurrency): string {
  return FOREIGN_FORMAT[currency].format(amount);
}
