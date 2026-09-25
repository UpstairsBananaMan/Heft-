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
  pickup: "Pickup truck",
  cargo_van: "Cargo van",
  box_truck: "Box truck",
  flatbed: "Flatbed",
};

/** Words a customer sees. Admin keeps STATUS_LABEL. */
export const CUSTOMER_STATUS: Record<JobStatus, string> = {
  draft: "Not booked yet",
  priced: "Your price is ready",
  open: "Finding your driver",
  assigned: "Driver confirmed",
  en_route_pickup: "Driver is on the way",
  at_pickup: "Driver is at pickup",
  en_route_dropoff: "On the way to you",
  at_dropoff: "Driver has arrived",
  delivered: "Delivered",
  paid: "Done, receipt ready",
  cancelled: "Cancelled",
  disputed: "We're looking into it",
};

/** The button that moves a job into this status. */
export const DRIVER_ACTION: Partial<Record<JobStatus, string>> = {
  en_route_pickup: "Start driving to pickup",
  at_pickup: "I'm at pickup",
  en_route_dropoff: "Loaded, start drop-off",
  at_dropoff: "I'm at drop-off",
  paid: "Finish delivery",
};

export const SIZE_LABEL: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xl: "Extra large",
  truckload: "Truckload",
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

/** Copy for the cancel control. Null when this role cannot cancel. */
export function cancelHint(status: JobStatus, role: Role): string | null {
  if (!canCancel(status, role)) return null;
  if (role === "customer") {
    return "You can cancel for free until your driver arrives at pickup.";
  }
  if (role === "driver") {
    return "You can cancel until you reach pickup. Cancelling often can pause your account.";
  }
  return "Cancelling ends the job.";
}

/** Why the dispute form is hidden. Null when a dispute can be opened. */
export function disputeBlockedReason(status: JobStatus, paidAt: string | null, now = Date.now()): string | null {
  if (canOpenDispute(status, paidAt, now)) return null;
  if (status === "draft" || status === "priced" || status === "open") {
    return "You can report a problem after a driver accepts.";
  }
  if (status === "cancelled") return "Cancelled jobs cannot be disputed.";
  if (status === "disputed") return "We're looking into it.";
  if (status === "paid") return "The 72-hour window after payment has closed.";
  return "This job cannot be disputed.";
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
