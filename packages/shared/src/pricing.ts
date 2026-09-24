import type { PricingRule, VehicleType } from "./types";

/** Platform keeps 15% of final_cents. Driver payout is the remainder. */
export const PLATFORM_FEE_RATE = 0.15;

/**
 * Vehicle differences are already in each pricing_rules row (base, per mile, min).
 * The published formula still multiplies by vehicle_mult; that factor is 1
 * so a box truck is not charged twice.
 */
export const VEHICLE_MULTIPLIERS: Record<VehicleType, number> = {
  pickup: 1,
  cargo_van: 1,
  box_truck: 1,
  flatbed: 1,
};

export function asNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") return Number.NaN;
  const n = typeof value === "number" ? value : Number(value);
  return n;
}

/**
 * amount = max(min_cents, base_cents + per_mile_cents * miles) * size_mult * vehicle_mult
 * Rounded to the nearest cent. Miles should already be the quoted distance.
 */
export function quoteCents(
  rule: Pick<
    PricingRule,
    "base_cents" | "per_mile_cents" | "min_cents" | "size_multiplier" | "vehicle_type"
  >,
  miles: number,
): number {
  if (!Number.isFinite(miles) || miles < 0) {
    throw new Error("Miles must be a non-negative number");
  }
  const sizeMult = asNumber(rule.size_multiplier);
  const vehicleMult = VEHICLE_MULTIPLIERS[rule.vehicle_type] ?? 1;
  if (!Number.isFinite(sizeMult) || sizeMult <= 0) {
    throw new Error("Size multiplier is invalid");
  }
  const raw = Math.max(rule.min_cents, rule.base_cents + rule.per_mile_cents * miles);
  return Math.round(raw * sizeMult * vehicleMult);
}

/** DEFAULT flat add-on when any stairs are declared. Not per flight. */
export const STAIRS_ADDON_CENTS = 1500;
/** DEFAULT flat add-on when the customer asks for a helper. */
export const HELPER_ADDON_CENTS = 2000;

export type QuoteLineKey = "base_miles" | "size" | "stairs" | "helper";

export type QuoteLine = {
  key: QuoteLineKey;
  label: string;
  cents: number;
};

/**
 * Line items always sum to total_cents. Stairs and helper are flat.
 * Drop-off placement is not an input: it never changes the price.
 */
export function quoteLines(
  rule: Pick<PricingRule, "base_cents" | "per_mile_cents" | "min_cents" | "size_multiplier" | "vehicle_type">,
  miles: number,
  options: { stairs?: boolean; helper?: boolean; vehicleLabel: string; sizeLabel: string },
): { lines: QuoteLine[]; total_cents: number } {
  const vehicleMult = VEHICLE_MULTIPLIERS[rule.vehicle_type] ?? 1;
  const sizeMult = asNumber(rule.size_multiplier);
  if (!Number.isFinite(miles) || miles < 0) throw new Error("Miles must be a non-negative number");
  if (!Number.isFinite(sizeMult) || sizeMult <= 0) throw new Error("Size multiplier is invalid");
  const raw = Math.max(rule.min_cents, rule.base_cents + rule.per_mile_cents * miles);
  const base = Math.round(raw * vehicleMult);
  const sized = Math.round(base * sizeMult);
  const lines: QuoteLine[] = [
    { key: "base_miles", label: `${options.vehicleLabel} · ${miles.toFixed(1)} mi`, cents: base },
  ];
  const sizeCents = sized - base;
  if (sizeCents !== 0) lines.push({ key: "size", label: `${options.sizeLabel} item`, cents: sizeCents });
  if (options.stairs) lines.push({ key: "stairs", label: "Stairs", cents: STAIRS_ADDON_CENTS });
  if (options.helper) lines.push({ key: "helper", label: "Helper to load", cents: HELPER_ADDON_CENTS });
  return { lines, total_cents: lines.reduce((sum, line) => sum + line.cents, 0) };
}

/** Driver share of a fare, computed from the platform rate. Never a hardcoded 85. */
export function driverKeepPercent(): number {
  return Math.round((1 - PLATFORM_FEE_RATE) * 100);
}

export function splitCents(finalCents: number): {
  platform_fee_cents: number;
  driver_payout_cents: number;
} {
  if (!Number.isInteger(finalCents) || finalCents < 0) {
    throw new Error("final_cents must be a non-negative integer");
  }
  const platform_fee_cents = Math.round(finalCents * PLATFORM_FEE_RATE);
  return {
    platform_fee_cents,
    driver_payout_cents: finalCents - platform_fee_cents,
  };
}

export function formatUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
