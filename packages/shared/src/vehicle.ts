import type { SizeCategory, VehicleType } from "./types";

/** Every launch job uses a pickup. Other vehicle classes are later. */
export function pickVehicle(_itemType: string, _size: SizeCategory): VehicleType {
  return "pickup";
}

export const ITEM_TYPES = [
  "couch",
  "couch_sectional",
  "couch_sleeper",
  "mattress",
  "appliance_fridge",
  "appliance_washer",
  "appliance_dryer",
  "appliance_washer_dryer",
  "appliance_stove",
  "appliance_other",
  "lumber",
  "furniture",
  "moving_out",
  "other",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_LABEL: Record<string, string> = {
  couch: "Couch",
  couch_sectional: "Sectional",
  couch_sleeper: "Sleeper sofa",
  mattress: "Mattress",
  appliance: "Appliance",
  appliance_fridge: "Fridge",
  appliance_washer: "Washer",
  appliance_dryer: "Dryer",
  appliance_washer_dryer: "Washer + dryer",
  appliance_stove: "Stove",
  appliance_other: "Other appliance",
  lumber: "Lumber / materials",
  furniture: "Furniture (other)",
  moving_out: "Moving out",
  other: "Other",
};

/** Preselected size from the tile or chip. Furniture and Other start unset. */
export const DEFAULT_SIZE: Record<string, SizeCategory | null> = {
  couch: "medium",
  mattress: "medium",
  appliance_fridge: "large",
  appliance_washer: "large",
  appliance_dryer: "large",
  appliance_washer_dryer: "large",
  appliance_stove: "large",
  lumber: "medium",
  moving_out: "truckload",
  couch_sectional: "large",
  couch_sleeper: "large",
  furniture: null,
  other: null,
  appliance: null,
};

export function defaultSize(itemType: string): SizeCategory | null {
  return DEFAULT_SIZE[itemType] ?? null;
}
