import type { PlacePreset } from "./types";

/** Named points inside the Pensacola box so quote works without Places. */
export const PENSACOLA_PLACES: PlacePreset[] = [
  {
    label: "Palafox Street",
    address: "21 E Government St, Pensacola, FL",
    lat: 30.4088,
    lng: -87.2166,
    zip: "32502",
  },
  {
    label: "Cordova Mall",
    address: "5100 N 9th Ave, Pensacola, FL",
    lat: 30.4758,
    lng: -87.208,
    zip: "32503",
  },
  {
    label: "Pensacola Airport",
    address: "2430 Airport Blvd, Pensacola, FL",
    lat: 30.4733,
    lng: -87.1867,
    zip: "32504",
  },
  {
    label: "East Hill",
    address: "1200 E Gadsden St, Pensacola, FL",
    lat: 30.436,
    lng: -87.191,
    zip: "32503",
  },
  {
    label: "Myrtle Grove",
    address: "4100 W Fairfield Dr, Pensacola, FL",
    lat: 30.421,
    lng: -87.283,
    zip: "32506",
  },
  {
    label: "North Hill",
    address: "412 N Spring St, Pensacola, FL",
    lat: 30.4165,
    lng: -87.221,
    zip: "32501",
  },
  {
    label: "Work",
    address: "7171 N Davis Hwy, Pensacola, FL",
    lat: 30.498,
    lng: -87.208,
    zip: "32514",
  },
];

/** Demo-only ends. Real builds never search this list. */
export const DEMO_PLACES: PlacePreset[] = [
  {
    label: "Mobile",
    address: "150 Government St, Mobile, AL",
    lat: 30.6954,
    lng: -88.0399,
    zip: "36602",
  },
  {
    label: "Daphne",
    address: "100 Main St, Daphne, AL",
    lat: 30.6035,
    lng: -87.9036,
    zip: "36526",
  },
  {
    label: "Unpinned lot",
    address: "Lot without a street number",
    lat: 30.42,
    lng: -87.22,
    zip: null,
  },
];

/** Nearest hardware store inside the service area. A suggestion the customer confirms. */
export const HARDWARE_SUGGESTION: PlacePreset = {
  label: "Home Depot",
  address: "500 E Nine Mile Rd, Pensacola, FL",
  lat: 30.52,
  lng: -87.22,
  zip: "32514",
};

/** Local Pensacola matches. Google Places is used when a maps key is set. */
export function filterPlaces(query: string, places: PlacePreset[] = PENSACOLA_PLACES): PlacePreset[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 3) return [];
  return places.filter(
    (place) =>
      !place.outside &&
      (place.label.toLowerCase().includes(needle) || place.address.toLowerCase().includes(needle)),
  );
}

type GooglePrediction = { description?: string; place_id?: string };

/**
 * Address search. With an API key, Google Places Autocomplete.
 * Presets are demo-only and never include a reject fixture.
 */
export async function searchPlaces(
  query: string,
  options?: { apiKey?: string; allowPresets?: boolean; sessionToken?: string },
): Promise<PlacePreset[]> {
  const needle = query.trim();
  if (needle.length < 3) return [];
  if (options?.apiKey) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", needle);
    url.searchParams.set("key", options.apiKey);
    url.searchParams.set("components", "country:us");
    url.searchParams.set("location", "30.4213,-87.2169");
    url.searchParams.set("radius", "40000");
    if (options.sessionToken) url.searchParams.set("sessiontoken", options.sessionToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Can't search right now. Check your connection.");
    const body = (await response.json()) as { predictions?: GooglePrediction[]; status?: string };
    if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
      throw new Error("Can't search right now. Check your connection.");
    }
    return (body.predictions ?? []).slice(0, 6).map((item) => ({
      label: item.description ?? needle,
      address: item.description ?? needle,
      lat: 30.4213,
      lng: -87.2169,
    }));
  }
  if (options?.allowPresets) return filterPlaces(needle);
  return [];
}
