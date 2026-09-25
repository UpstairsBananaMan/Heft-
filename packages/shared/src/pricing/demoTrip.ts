import { haversineMiles } from "../geo";
import { PICKUP_RATES } from "./computeQuote";
import { normalizeZip, zipInZone } from "./zone";

export type TripEnd = {
  lat: number;
  lng: number;
  address?: string;
  label?: string;
  zip?: string | null;
};

export type DemoDistanceSource = "demo" | "estimated";

export type DemoTrip =
  | {
      ok: true;
      roadMiles: number;
      pickupZip: string;
      dropoffZip: string;
      pickupInZone: boolean;
      dropoffInZone: boolean;
      distanceSource: DemoDistanceSource;
      distanceLabel: string;
    }
  | { ok: false; error: "NO_ZIP" | "OUTSIDE_SERVICE_AREA" | "TOO_FAR" };

const FIXED_MILES: Record<string, number> = {
  "30.409,-87.217|30.476,-87.208": 10,
  "30.476,-87.208|30.409,-87.217": 10,
  "30.409,-87.217|30.695,-88.040": 60,
  "30.695,-88.040|30.409,-87.217": 60,
  "30.695,-88.040|30.695,-88.040": 8,
};

function pointKey(end: TripEnd): string {
  return `${end.lat.toFixed(3)},${end.lng.toFixed(3)}`;
}

/**
 * Known demo pairs use fixed road miles and are labeled "demo".
 * Anything else is the straight-line ×1.3 estimate, labeled estimated.
 * Demo booking of an estimate stays behind the demo flag and says "Demo distance".
 * Real quotes never call this, and real publish refuses estimated.
 */
export function demoRoadMiles(pickup: TripEnd, dropoff: TripEnd): { miles: number; source: DemoDistanceSource } {
  const fixed = FIXED_MILES[`${pointKey(pickup)}|${pointKey(dropoff)}`];
  if (fixed != null) return { miles: fixed, source: "demo" };
  const straight = haversineMiles(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const scaled = Math.round(straight * 1.3 * 100) / 100;
  return { miles: Math.max(1, Math.ceil(scaled)), source: "estimated" };
}

export function demoTrip(pickup: TripEnd, dropoff: TripEnd): DemoTrip {
  const pickupZip = normalizeZip(pickup.zip);
  const dropoffZip = normalizeZip(dropoff.zip);
  if (!pickupZip || !dropoffZip) return { ok: false, error: "NO_ZIP" };
  const pickupInZone = zipInZone(pickupZip);
  const dropoffInZone = zipInZone(dropoffZip);
  if (!pickupInZone && !dropoffInZone) return { ok: false, error: "OUTSIDE_SERVICE_AREA" };
  const road = demoRoadMiles(pickup, dropoff);
  if (Math.ceil(Math.round(road.miles * 100) / 100) > PICKUP_RATES.maxLoadedMiles) return { ok: false, error: "TOO_FAR" };
  return {
    ok: true,
    roadMiles: road.miles,
    pickupZip,
    dropoffZip,
    pickupInZone,
    dropoffInZone,
    distanceSource: road.source,
    distanceLabel: road.source === "demo" ? "Demo road miles" : "Demo distance. You can still book in this demo.",
  };
}
