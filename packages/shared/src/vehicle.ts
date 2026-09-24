import type { SizeCategory, VehicleType } from "./types";

/** DEFAULT mapping. Lumber uses a flatbed only when the load is large. */
export function pickVehicle(itemType: string, size: SizeCategory): VehicleType {
  if (itemType === "lumber") {
    return size === "large" || size === "xl" ? "flatbed" : "pickup";
  }
  if (size === "small" || size === "medium") return "pickup";
  if (size === "large") return "cargo_van";
  return "box_truck";
}

export const ITEM_TYPES = ["couch", "mattress", "appliance", "lumber", "furniture", "other"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_LABEL: Record<ItemType, string> = {
  couch: "Couch",
  mattress: "Mattress",
  appliance: "Appliance",
  lumber: "Lumber / materials",
  furniture: "Furniture (other)",
  other: "Other",
};
