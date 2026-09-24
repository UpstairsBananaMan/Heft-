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

/** Copy for the cancel control. Null when this role cannot cancel. */
export function cancelHint(status: JobStatus, role: Role): string | null {
  if (!canCancel(status, role)) return null;
  if (role === "customer" && (status === "draft" || status === "priced" || status === "open")) {
    return "No driver has accepted yet. Cancelling ends the request and releases a sandbox hold.";
  }
  if (role === "customer") {
    return "A driver is assigned. You can cancel until they mark at pickup. The job ends. It does not go back on the map.";
  }
  if (role === "driver") {
    return "You can cancel while assigned or en route to pickup. The job ends for you and the customer.";
  }
  return "Cancelling ends the job.";
}

/** Why the dispute form is hidden. Null when a dispute can be opened. */
export function disputeBlockedReason(status: JobStatus, paidAt: string | null, now = Date.now()): string | null {
  if (canOpenDispute(status, paidAt, now)) return null;
  if (status === "draft" || status === "priced" || status === "open") {
    return "You can open a dispute after a driver accepts.";
  }
  if (status === "cancelled") return "Cancelled jobs cannot be disputed.";
  if (status === "disputed") return "A dispute is already open. Dispatch reviews it in the admin console.";
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
