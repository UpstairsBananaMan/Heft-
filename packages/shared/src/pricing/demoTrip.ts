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

export type DemoTrip =
  | {
      ok: true;
      roadMiles: number;
      pickupZip: string;
      dropoffZip: string;
      pickupInZone: boolean;
      dropoffInZone: boolean;
      distanceSource: "maps";
    }
  | { ok: false; error: "NO_ZIP" | "OUTSIDE_SERVICE_AREA" | "TOO_FAR" };

const MOBILE = { lat: 30.6954, lng: -88.0399 };

function near(a: TripEnd, lat: number, lng: number): boolean {
  return Math.abs(a.lat - lat) < 0.02 && Math.abs(a.lng - lng) < 0.02;
}

/** Fixed demo road miles. Mobile is 60. Marked maps so the demo quote is bookable. */
export function demoRoadMiles(pickup: TripEnd, dropoff: TripEnd): number {
  const pickupMobile = near(pickup, MOBILE.lat, MOBILE.lng);
  const dropMobile = near(dropoff, MOBILE.lat, MOBILE.lng);
  if (pickupMobile && dropMobile) return 8;
  if (pickupMobile || dropMobile) return 60;
  const straight = haversineMiles(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const scaled = Math.round(straight * 1.3 * 100) / 100;
  return Math.max(1, Math.ceil(scaled));
}

export function demoTrip(pickup: TripEnd, dropoff: TripEnd): DemoTrip {
  const pickupZip = normalizeZip(pickup.zip);
  const dropoffZip = normalizeZip(dropoff.zip);
  if (!pickupZip || !dropoffZip) return { ok: false, error: "NO_ZIP" };
  const pickupInZone = zipInZone(pickupZip);
  const dropoffInZone = zipInZone(dropoffZip);
  if (!pickupInZone && !dropoffInZone) return { ok: false, error: "OUTSIDE_SERVICE_AREA" };
  const roadMiles = demoRoadMiles(pickup, dropoff);
  if (Math.ceil(Math.round(roadMiles * 100) / 100) > PICKUP_RATES.maxLoadedMiles) return { ok: false, error: "TOO_FAR" };
  return { ok: true, roadMiles, pickupZip, dropoffZip, pickupInZone, dropoffInZone, distanceSource: "maps" };
}
