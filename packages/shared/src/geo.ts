import { APP_NAME } from "./brand";

/** Pensacola MVP box. Coordinates stay in code, never in customer copy. */
export const PENSACOLA_BOX = {
  minLat: 30.1,
  maxLat: 30.7,
  minLng: -87.6,
  maxLng: -86.9,
} as const;

export const PENSACOLA_CENTER = { lat: 30.4213, lng: -87.2169 };

const EARTH_MILES = 3958.7613;

export function serviceAreaHint(address?: string): string {
  if (address) return `We only serve the Pensacola area right now. ${address} is outside it.`;
  return `${APP_NAME} only serves the Pensacola area right now.`;
}

/** Neighbourhood label for a stored address. Never returns coordinates. */
export function neighbourhood(address: string): string {
  const value = address.toLowerCase();
  if (value.includes("gadsden")) return "East Hill";
  if (value.includes("9th")) return "Cordova";
  if (value.includes("government") || value.includes("palafox")) return "Downtown";
  if (value.includes("airport")) return "Airport";
  if (value.includes("fairfield")) return "Myrtle Grove";
  if (value.includes("spring")) return "North Hill";
  if (value.includes("davis")) return "Davis Hwy";
  return "Pensacola";
}

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

/** Great-circle miles. Sandbox stand-in for Distance Matrix. */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_MILES * c;
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 100) / 100;
}

export const VEHICLE_RANK: Record<string, number> = {
  pickup: 1,
  cargo_van: 2,
  box_truck: 3,
  flatbed: 4,
};

export function vehicleCovers(driverVehicle: string, required: string): boolean {
  return (VEHICLE_RANK[driverVehicle] ?? 0) >= (VEHICLE_RANK[required] ?? 99);
}
