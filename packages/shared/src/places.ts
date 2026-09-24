import type { PlacePreset } from "./types";

/** Named points inside the Pensacola box so quote works without Places. */
export const PENSACOLA_PLACES: PlacePreset[] = [
  {
    label: "Palafox Street",
    address: "21 E Government St, Pensacola, FL",
    lat: 30.4088,
    lng: -87.2166,
  },
  {
    label: "Cordova Mall",
    address: "5100 N 9th Ave, Pensacola, FL",
    lat: 30.4758,
    lng: -87.208,
  },
  {
    label: "Pensacola Airport",
    address: "2430 Airport Blvd, Pensacola, FL",
    lat: 30.4733,
    lng: -87.1867,
  },
  {
    label: "East Hill",
    address: "1200 E Gadsden St, Pensacola, FL",
    lat: 30.436,
    lng: -87.191,
  },
  {
    label: "Myrtle Grove",
    address: "4100 W Fairfield Dr, Pensacola, FL",
    lat: 30.421,
    lng: -87.283,
  },
  {
    label: "Outside service box (test reject)",
    address: "Mobile, AL — outside Pensacola box",
    lat: 30.6954,
    lng: -88.0399,
    outside: true,
  },
];
