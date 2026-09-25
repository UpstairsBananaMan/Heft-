import { PICKUP_RATES } from "./pricing/computeQuote";

/** Platform keeps 15% of the total. The driver side keeps the rest. */
export const PLATFORM_FEE_RATE = PICKUP_RATES.platformFeeBps / 10000;

/** Driver-side share of a fare. On a 2-person job this is the lead plus the partner, not the lead alone. */
export function driverKeepPercent(): number {
  return Math.round((1 - PLATFORM_FEE_RATE) * 100);
}

export function formatUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
