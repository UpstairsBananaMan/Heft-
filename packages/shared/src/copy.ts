import { APP_NAME } from "./brand";
import { STATUS_LABEL, VEHICLE_LABEL } from "./status";
import type { JobStatus } from "./types";

/** Turn a failed request into copy a non-developer can act on. Never includes secrets. */
export function loadFailureCopy(message: string): { title: string; body: string } {
  const offline = /network|offline|fetch|abort|timeout|failed to connect/i.test(message);
  if (offline) {
    return {
      title: "You look offline",
      body: `${APP_NAME} could not reach the server. Check Wi-Fi, then try again. Your last action was not saved if this screen stayed empty.`,
    };
  }
  return {
    title: "Could not load",
    body: message || "Something went wrong. Try again.",
  };
}

/** One label for a driver job card. The accept control is a separate focus stop. */
export function jobA11yLabel(job: {
  driver_payout_cents?: number | null;
  final_cents?: number | null;
  item_description?: string | null;
  size_category?: string | null;
  distance_miles?: number | string | null;
}): string {
  const cents = job.driver_payout_cents ?? job.final_cents ?? 0;
  const dollars = (cents / 100).toFixed(2);
  const miles = job.distance_miles == null ? "" : `, ${Number(job.distance_miles).toFixed(1)} miles`;
  return `${job.item_description ?? "Item"}, payout ${dollars} dollars${miles}`;
}

export function vehiclePhrase(type: string | null | undefined): string {
  if (!type) return "Vehicle";
  return VEHICLE_LABEL[type] ?? "Vehicle";
}

const EVENT_LABEL: Record<string, string> = {
  status_restored: "Status restored",
  payout_available: "Payout recorded",
};

export function eventLabel(type: string): string {
  if (type in STATUS_LABEL) return STATUS_LABEL[type as JobStatus];
  if (type in EVENT_LABEL) return EVENT_LABEL[type];
  return type.replaceAll("_", " ");
}
