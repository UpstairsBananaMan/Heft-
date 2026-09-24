import type { JobStatus, Role } from "./types";

export const STATUS_LABEL: Record<JobStatus, string> = {
  draft: "Draft",
  priced: "Priced",
  open: "Open",
  assigned: "Assigned",
  en_route_pickup: "En route to pickup",
  at_pickup: "At pickup",
  en_route_dropoff: "En route to drop-off",
  at_dropoff: "At drop-off",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export const VEHICLE_LABEL: Record<string, string> = {
  pickup: "Pickup",
  cargo_van: "Cargo van",
  box_truck: "Box truck",
  flatbed: "Flatbed",
};

export const SIZE_LABEL: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xl: "XL",
};

/** Driver-operated forward steps. delivered → paid is complete-job, not this map. */
export const DRIVER_NEXT: Partial<Record<JobStatus, JobStatus>> = {
  assigned: "en_route_pickup",
  en_route_pickup: "at_pickup",
  at_pickup: "en_route_dropoff",
  en_route_dropoff: "at_dropoff",
  at_dropoff: "delivered",
};

const CUSTOMER_CANCEL: JobStatus[] = ["draft", "priced", "open", "assigned", "en_route_pickup"];
const DRIVER_CANCEL: JobStatus[] = ["assigned", "en_route_pickup"];

export function nextDriverStatus(status: JobStatus): JobStatus | null {
  return DRIVER_NEXT[status] ?? null;
}

export function canCancel(status: JobStatus, role: Role): boolean {
  if (role === "customer") return CUSTOMER_CANCEL.includes(status);
  if (role === "driver") return DRIVER_CANCEL.includes(status);
  if (role === "admin") return !["cancelled", "paid", "draft"].includes(status);
  return false;
}

export function isActiveDelivery(status: JobStatus): boolean {
  return [
    "assigned",
    "en_route_pickup",
    "at_pickup",
    "en_route_dropoff",
    "at_dropoff",
    "delivered",
  ].includes(status);
}

/** Either party may open a dispute after assign, and within 72h after paid. */
export function canOpenDispute(status: JobStatus, paidAt: string | null, now = Date.now()): boolean {
  const afterAssign: JobStatus[] = [
    "assigned",
    "en_route_pickup",
    "at_pickup",
    "en_route_dropoff",
    "at_dropoff",
    "delivered",
    "paid",
  ];
  if (!afterAssign.includes(status)) return false;
  if (status !== "paid") return true;
  if (!paidAt) return false;
  const elapsed = now - new Date(paidAt).getTime();
  return elapsed >= 0 && elapsed <= 72 * 60 * 60 * 1000;
}
