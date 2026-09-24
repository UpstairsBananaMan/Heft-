import type { PlacePreset, QuoteLine, SizeCategory } from "@heft/shared";
import { create } from "zustand";

export type BookingStep = "home" | "item" | "price";

type BookingState = {
  pickup: PlacePreset | null;
  dropoff: PlacePreset | null;
  itemType: string | null;
  itemDescription: string;
  size: SizeCategory | null;
  stairs: boolean;
  stairsPickupFlights: number;
  stairsDropoffFlights: number;
  needsHelper: boolean;
  dropoffPlacement: "inside" | "curbside";
  notes: string;
  photos: string[];
  step: BookingStep;
  jobId: string | null;
  lines: QuoteLine[] | null;
  totalCents: number | null;
  miles: number | null;
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
  stairs: false,
  stairsPickupFlights: 0,
  stairsDropoffFlights: 0,
  needsHelper: false,
  dropoffPlacement: "inside" as const,
  notes: "",
  photos: [] as string[],
  step: "home" as BookingStep,
  jobId: null,
  lines: null,
  totalCents: null,
  miles: null,
};

export const useBooking = create<BookingState>((set) => ({
  ...empty,
  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
  swap: () => set((state) => ({ pickup: state.dropoff, dropoff: state.pickup })),
  patch: (partial) => set(partial),
  reset: () => set(empty),
}));
