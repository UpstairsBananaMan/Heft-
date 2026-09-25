import { haversineMiles } from "./pricing.ts";

export async function routeMiles(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<{ miles: number; source: "maps" | "estimated" }> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (key) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", `${pickupLat},${pickupLng}`);
      url.searchParams.set("destinations", `${dropoffLat},${dropoffLng}`);
      url.searchParams.set("mode", "driving");
      url.searchParams.set("units", "imperial");
      url.searchParams.set("key", key);
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        const meters = body?.rows?.[0]?.elements?.[0]?.distance?.value;
        if (body?.status === "OK" && typeof meters === "number") {
          return { miles: meters / 1609.344, source: "maps" };
        }
      }
      console.warn("Distance Matrix unavailable, using an estimate");
    } catch (err) {
      console.warn("Distance Matrix failed, using an estimate", err);
    }
  }
  const straight = haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const scaled = Math.round(straight * 1.3 * 100) / 100;
  return { miles: Math.max(1, Math.ceil(scaled)), source: "estimated" };
}

export async function postalCode(lat: number, lng: number): Promise<string | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", key);
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = await res.json();
    const components = body?.results?.[0]?.address_components as { types?: string[]; short_name?: string }[] | undefined;
    const postal = components?.find((part) => part.types?.includes("postal_code"))?.short_name;
    return postal ?? null;
  } catch {
    return null;
  }
}
