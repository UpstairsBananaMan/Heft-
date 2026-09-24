import { haversineMiles, roundMiles } from "./pricing.ts";

export async function routeMiles(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<{ miles: number; source: "google" | "haversine" }> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (key) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", `${pickupLat},${pickupLng}`);
      url.searchParams.set("destinations", `${dropoffLat},${dropoffLng}`);
      url.searchParams.set("units", "imperial");
      url.searchParams.set("key", key);
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        const meters = body?.rows?.[0]?.elements?.[0]?.distance?.value;
        if (body?.status === "OK" && typeof meters === "number") {
          return { miles: roundMiles(meters / 1609.344), source: "google" };
        }
      }
      console.warn("Distance Matrix unavailable, using haversine");
    } catch (err) {
      console.warn("Distance Matrix failed, using haversine", err);
    }
  }
  return {
    miles: roundMiles(haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng)),
    source: "haversine",
  };
}
