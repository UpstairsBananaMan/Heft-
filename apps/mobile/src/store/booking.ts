import type { PlacePreset, QuoteLine, SizeCategory } from "@heft/shared";
import { create } from "zustand";

export type BookingStep = "home" | "item" | "size" | "price";
export type AddressNext = "item" | "size" | "price";
export type WeightBand = "under_150" | "150_300" | "over_300";

export type TripQuote = {
  roadMiles: number;
  pickupZip: string;
  dropoffZip: string;
  pickupInZone: boolean;
  dropoffInZone: boolean;
  distanceSource: "maps";
};

type BookingState = {
  pickup: PlacePreset | null;
  dropoff: PlacePreset | null;
  itemType: string | null;
  itemDescription: string;
  size: SizeCategory | null;
  stairsPickupFlights: number;
  stairsDropoffFlights: number;
  stairsOpen: boolean;
  needsSecondPerson: boolean;
  weightBand: WeightBand | null;
  dropoffPlacement: "inside" | "curbside";
  notes: string;
  photos: string[];
  step: BookingStep;
  presetItem: boolean;
  suggestHardware: boolean;
  skipAfterAddress: AddressNext;
  jobId: string | null;
  lines: QuoteLine[] | null;
  totalCents: number | null;
  miles: number | null;
  trip: TripQuote | null;
  setPickup: (place: PlacePreset | null) => void;
  setDropoff: (place: PlacePreset | null) => void;
  swap: () => void;
  patch: (partial: Partial<BookingState>) => void;
  reset: () => void;
};

const empty = {
  pickup: null,
  dropoff: null,
  itemType: null,
  itemDescription: "",
  size: null,
  stairsPickupFlights: 0,
  stairsDropoffFlights: 0,
  stairsOpen: false,
  needsSecondPerson: false,
  weightBand: null as WeightBand | null,
  dropoffPlacement: "inside" as const,
  notes: "",
  photos: [] as string[],
  step: "home" as BookingStep,
  presetItem: false,
  suggestHardware: false,
  skipAfterAddress: "item" as AddressNext,
  jobId: null,
  lines: null,
  totalCents: null,
  miles: null,
  trip: null as TripQuote | null,
};

export const useBooking = create<BookingState>((set) => ({
  ...empty,
  setPickup: (pickup) => set({ pickup, trip: null, lines: null, totalCents: null }),
  setDropoff: (dropoff) => set({ dropoff, trip: null, lines: null, totalCents: null }),
  swap: () => set((state) => ({ pickup: state.dropoff, dropoff: state.pickup, trip: null, lines: null, totalCents: null })),
  patch: (partial) => set(partial),
  reset: () => set(empty),
}));
