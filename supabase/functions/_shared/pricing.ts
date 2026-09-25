/**
 * Distance helpers stay here. The quote formula is the shared file.
 * Deno loads that file by relative path. Do not copy it.
 */
export {
  PICKUP_RATES,
  QuoteError,
  billableMiles,
  computeQuote,
  customerLines,
  estimateJobMinutes,
  type QuoteInput,
  type Rates,
} from "../../../packages/shared/src/pricing/computeQuote.ts";
export { normalizeZip, SERVICE_ZONE_ZIPS, zipInZone } from "../../../packages/shared/src/pricing/zone.ts";
export { requiresSecondPerson } from "../../../packages/shared/src/pricing/secondPerson.ts";
export {
  ESTIMATED_DISTANCE_ALERT,
  FARTHER,
  PIN_DOWN,
  canReuseMapsDistance,
  coverageDecision,
  missingPayouts,
  payoutsComplete,
  ratesFromCard,
  requiredPayouts,
  twoPersonProgressBlock,
  zipInListedZone,
} from "../../../packages/shared/src/pricing/serverRules.ts";

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earth = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}
