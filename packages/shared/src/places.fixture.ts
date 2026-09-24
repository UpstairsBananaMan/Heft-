import type { PlacePreset } from "./types";

/** Test-only stop outside the Pensacola box. Not shipped in the app. */
export const OUTSIDE_SERVICE_FIXTURE: PlacePreset = {
  label: "Outside service box (test reject)",
  address: "1 Government St, Mobile, AL",
  lat: 30.6954,
  lng: -88.0399,
  outside: true,
};
