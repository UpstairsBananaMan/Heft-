export type WeightBand = "under_150" | "150_300" | "over_300";

export function requiresSecondPerson(input: {
  itemType?: string | null;
  size?: string | null;
  weightBand?: string | null;
  pickupFlights?: number;
  dropoffFlights?: number;
}): boolean {
  const item = input.itemType ?? "";
  const size = input.size ?? "";
  const flights = (input.pickupFlights ?? 0) + (input.dropoffFlights ?? 0);
  if (item === "appliance_fridge" || item === "appliance_washer_dryer" || item === "couch_sleeper" || item === "couch_sectional") {
    return true;
  }
  if (input.weightBand === "150_300") return true;
  if (size === "large" && flights > 0) return true;
  if (item === "moving_out" || size === "truckload") return true;
  return false;
}

const REFUSED = [/\bpiano\b/i, /\bsafe\b/i, /\bpool table\b/i, /\bhot tub\b/i, /\bspa\b/i, /\bjacuzzi\b/i];

export function wontTakeItem(description: string, weightBand?: string | null): boolean {
  if (weightBand === "over_300") return true;
  return REFUSED.some((pattern) => pattern.test(description));
}

export const WONT_TAKE_COPY = "We can't move this one yet. We're starting with furniture, appliances, and materials.";
