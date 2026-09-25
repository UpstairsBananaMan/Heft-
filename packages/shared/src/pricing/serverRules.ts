/**
 * Rules the real quote, publish, payout, and partner paths share.
 * No I/O. Edge functions and the demo backend both call these.
 */
import { PICKUP_RATES, billableMiles, type Rates, type SizeTier } from "./computeQuote";
import { normalizeZip } from "./zone";

export type { Rates };

export const PIN_DOWN =
  "We couldn't pin down that address. Try adding the street number, or pick a suggestion from the list.";
export const FARTHER =
  "That's farther than we go right now. We cover trips that start or end around Pensacola, up to 70 miles.";
export const ESTIMATED_DISTANCE_ALERT =
  "Maps distance was unavailable. This quote used an estimate and cannot be booked.";

/** Columns a customer must not write. The quote function sets them. */
export const LOCKED_JOB_COLUMNS = [
  "distance_miles",
  "billable_miles",
  "distance_source",
  "pickup_in_zone",
  "dropoff_in_zone",
  "pickup_zip",
  "dropoff_zip",
  "estimate_cents",
  "final_cents",
  "platform_fee_cents",
  "driver_share_cents",
  "driver_payout_cents",
  "lead_payout_cents",
  "helper_payout_cents",
  "est_job_minutes",
  "rates_version",
  "quoted_at",
  "needs_second_person",
  "quoted_pickup_lat",
  "quoted_pickup_lng",
  "quoted_dropoff_lat",
  "quoted_dropoff_lng",
  "quote_lines",
] as const;

export type LockedJobColumn = (typeof LOCKED_JOB_COLUMNS)[number];

const DRIVING = ["assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"] as const;
const PAST_ACCEPTED = ["en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff", "delivered"] as const;

export function zipInListedZone(zip: string | null | undefined, zoneZips: readonly string[]): boolean {
  const normalized = normalizeZip(zip);
  if (!normalized) return false;
  return zoneZips.some((row) => normalizeZip(row) === normalized);
}

export function canReuseMapsDistance(saved: {
  distance_source?: string | null;
  billable_miles?: number | null;
  distance_miles?: number | null;
  quoted_pickup_lat?: number | null;
  quoted_pickup_lng?: number | null;
  quoted_dropoff_lat?: number | null;
  quoted_dropoff_lng?: number | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
}): boolean {
  if (saved.distance_source !== "maps") return false;
  if (!Number.isFinite(Number(saved.billable_miles)) || !Number.isFinite(Number(saved.distance_miles))) return false;
  const pairs: [number | null | undefined, number | null | undefined][] = [
    [saved.quoted_pickup_lat, saved.pickup_lat],
    [saved.quoted_pickup_lng, saved.pickup_lng],
    [saved.quoted_dropoff_lat, saved.dropoff_lat],
    [saved.quoted_dropoff_lng, saved.dropoff_lng],
  ];
  return pairs.every(([quoted, current]) => Number.isFinite(Number(quoted)) && Number(quoted) === Number(current));
}

type RateCard = {
  rates_version: string;
  base_cents: number;
  per_mile_cents: number;
  min_fare_cents: number;
  platform_fee_bps: number;
  stairs_per_flight_cents: number;
  second_person_per_hour_cents: number;
  second_person_min_cents: number;
  second_person_step_cents: number;
  out_of_town_per_mile_cents: number;
  max_loaded_miles: number;
  max_flights_per_stop: number;
  est_deadhead_miles: number;
  est_city_min_per_mile: number;
  est_highway_min_per_mile: number;
  est_highway_after_miles: number;
  est_admin_minutes: number;
  est_minutes_per_flight: number;
};

export function ratesFromCard(
  card: RateCard | null | undefined,
  tiers: { size_tier: string; addon_cents: number; est_load_minutes: number }[] | null | undefined,
): Rates {
  if (!card) return PICKUP_RATES;
  const sizeTierAddonCents = { ...PICKUP_RATES.sizeTierAddonCents };
  const estLoadMinutes = { ...PICKUP_RATES.estLoadMinutes };
  for (const row of tiers ?? []) {
    if (row.size_tier in sizeTierAddonCents) {
      sizeTierAddonCents[row.size_tier as SizeTier] = Number(row.addon_cents);
      estLoadMinutes[row.size_tier as SizeTier] = Number(row.est_load_minutes);
    }
  }
  return {
    ratesVersion: card.rates_version,
    baseCents: Number(card.base_cents),
    perMileCents: Number(card.per_mile_cents),
    minFareCents: Number(card.min_fare_cents),
    platformFeeBps: Number(card.platform_fee_bps),
    sizeTierAddonCents,
    stairsPerFlightCents: Number(card.stairs_per_flight_cents),
    secondPersonPerHourCents: Number(card.second_person_per_hour_cents),
    secondPersonMinCents: Number(card.second_person_min_cents),
    secondPersonStepCents: Number(card.second_person_step_cents),
    outOfTownPerMileCents: Number(card.out_of_town_per_mile_cents),
    maxLoadedMiles: Number(card.max_loaded_miles),
    maxFlightsPerStop: Number(card.max_flights_per_stop),
    estDeadheadMiles: Number(card.est_deadhead_miles),
    estCityMinPerMile: Number(card.est_city_min_per_mile),
    estHighwayMinPerMile: Number(card.est_highway_min_per_mile),
    estHighwayAfterMiles: Number(card.est_highway_after_miles),
    estLoadMinutes,
    estAdminMinutes: Number(card.est_admin_minutes),
    estMinutesPerFlight: Number(card.est_minutes_per_flight),
  };
}

export function coverageDecision(input: {
  pickupZip: string | null;
  dropoffZip: string | null;
  roadMiles: number;
  zoneZips: readonly string[];
  maxMiles?: number;
}):
  | { ok: true; pickupZip: string; dropoffZip: string; pickupInZone: boolean; dropoffInZone: boolean; billableMiles: number }
  | { ok: false; code: "NO_ZIP" | "OUTSIDE_SERVICE_AREA" | "TOO_FAR"; message: string } {
  const pickupZip = normalizeZip(input.pickupZip);
  const dropoffZip = normalizeZip(input.dropoffZip);
  if (!pickupZip || !dropoffZip) return { ok: false, code: "NO_ZIP", message: PIN_DOWN };
  const pickupInZone = zipInListedZone(pickupZip, input.zoneZips);
  const dropoffInZone = zipInListedZone(dropoffZip, input.zoneZips);
  if (!pickupInZone && !dropoffInZone) return { ok: false, code: "OUTSIDE_SERVICE_AREA", message: FARTHER };
  const miles = billableMiles(input.roadMiles);
  const maxMiles = input.maxMiles ?? PICKUP_RATES.maxLoadedMiles;
  if (miles > maxMiles) return { ok: false, code: "TOO_FAR", message: FARTHER };
  return { ok: true, pickupZip, dropoffZip, pickupInZone, dropoffInZone, billableMiles: miles };
}

/** Customer inserts start clean. Customer updates keep the server's pricing columns. */
export function protectCustomerJobWrite(
  before: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...incoming };
  for (const column of LOCKED_JOB_COLUMNS) {
    if (before && column in before) next[column] = before[column];
    else delete next[column];
  }
  return next;
}

export type PayoutNeed = { role: "lead" | "partner"; driverId: string; amountCents: number };

export function requiredPayouts(job: {
  driver_id?: string | null;
  partner_driver_id?: string | null;
  needs_second_person?: boolean | null;
  lead_payout_cents?: number | null;
  driver_payout_cents?: number | null;
  helper_payout_cents?: number | null;
}): PayoutNeed[] {
  if (!job.driver_id) return [];
  const needs: PayoutNeed[] = [
    {
      role: "lead",
      driverId: job.driver_id,
      amountCents: Number(job.lead_payout_cents ?? job.driver_payout_cents ?? 0),
    },
  ];
  const helper = Number(job.helper_payout_cents ?? 0);
  if (job.needs_second_person && job.partner_driver_id && helper > 0) {
    needs.push({ role: "partner", driverId: job.partner_driver_id, amountCents: helper });
  }
  return needs;
}

export function missingPayouts(
  required: PayoutNeed[],
  existing: { driver_id?: string | null; role?: string | null }[],
): PayoutNeed[] {
  return required.filter((need) => !existing.some((row) => row.driver_id === need.driverId));
}

export function payoutsComplete(
  required: PayoutNeed[],
  existing: { driver_id?: string | null; role?: string | null }[],
): boolean {
  return required.length > 0 && missingPayouts(required, existing).length === 0;
}

export function inviteBlock(
  lead: { status?: string | null; partner_only?: boolean | null } | null | undefined,
  acceptedAsPartner: boolean,
): string | null {
  if (!lead || lead.status !== "approved" || lead.partner_only === true) {
    return "Only an approved lead can invite a partner";
  }
  if (acceptedAsPartner) return "You are partnered today";
  return null;
}

export function respondBlock(inviteeHasLeadJob: boolean): string | null {
  if (inviteeHasLeadJob) return "Finish your current job first";
  return null;
}

export function leadJobInProgress(status: string): boolean {
  return (DRIVING as readonly string[]).includes(status);
}

export function twoPersonProgressBlock(
  job: { needs_second_person?: boolean | null; partner_driver_id?: string | null; partner_lost_at?: string | null },
  nextStatus: string,
): string | null {
  if (!job.needs_second_person) return null;
  if (!(PAST_ACCEPTED as readonly string[]).includes(nextStatus)) return null;
  if (job.partner_lost_at || !job.partner_driver_id) return "Add a partner before continuing this job";
  return null;
}

export function replacementPartnerPatch(partnerId: string): { partner_driver_id: string; partner_lost_at: null } {
  return { partner_driver_id: partnerId, partner_lost_at: null };
}
