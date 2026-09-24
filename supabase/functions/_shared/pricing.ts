/**
 * Keep in sync with packages/shared/src/pricing.ts and geo.ts.
 * Edge functions cannot import the workspace package.
 */

export const PLATFORM_FEE_RATE = 0.15;

export const VEHICLE_MULTIPLIERS: Record<string, number> = {
  pickup: 1,
  cargo_van: 1,
  box_truck: 1,
  flatbed: 1,
};

export const VEHICLE_RANK: Record<string, number> = {
  pickup: 1,
  cargo_van: 2,
  box_truck: 3,
  flatbed: 4,
};

export const PENSACOLA_BOX = {
  minLat: 30.1,
  maxLat: 30.7,
  minLng: -87.6,
  maxLng: -86.9,
};

export function inPensacola(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= PENSACOLA_BOX.minLat &&
    lat <= PENSACOLA_BOX.maxLat &&
    lng >= PENSACOLA_BOX.minLng &&
    lng <= PENSACOLA_BOX.maxLng
  );
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3958.7613 * c;
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 100) / 100;
}

/** DEFAULT flat add-on when any stairs are declared. Not per flight. */
export const STAIRS_ADDON_CENTS = 1500;
/** DEFAULT flat add-on when the customer asks for a helper. */
export const HELPER_ADDON_CENTS = 2000;

export type QuoteLine = { key: "base_miles" | "size" | "stairs" | "helper"; label: string; cents: number };

/** Line items always sum to total_cents. Placement never changes the price. */
export function quoteLines(
  rule: {
    base_cents: number;
    per_mile_cents: number;
    min_cents: number;
    size_multiplier: number | string;
    vehicle_type: string;
  },
  miles: number,
  options: { stairs?: boolean; helper?: boolean; vehicleLabel: string; sizeLabel: string },
): { lines: QuoteLine[]; total_cents: number } {
  const vehicleMult = VEHICLE_MULTIPLIERS[rule.vehicle_type] ?? 1;
  const sizeMult = Number(rule.size_multiplier);
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

export function quoteCents(
  rule: {
    base_cents: number;
    per_mile_cents: number;
    min_cents: number;
    size_multiplier: number | string;
    vehicle_type: string;
  },
  miles: number,
): number {
  const sizeMult = Number(rule.size_multiplier);
  const vehicleMult = VEHICLE_MULTIPLIERS[rule.vehicle_type] ?? 1;
  const raw = Math.max(rule.min_cents, rule.base_cents + rule.per_mile_cents * miles);
  return Math.round(raw * sizeMult * vehicleMult);
}

export function splitCents(finalCents: number): {
  platform_fee_cents: number;
  driver_payout_cents: number;
} {
  const platform_fee_cents = Math.round(finalCents * PLATFORM_FEE_RATE);
  return {
    platform_fee_cents,
    driver_payout_cents: finalCents - platform_fee_cents,
  };
}

export function vehicleCovers(driverVehicle: string, required: string): boolean {
  return (VEHICLE_RANK[driverVehicle] ?? 0) >= (VEHICLE_RANK[required] ?? 99);
}
