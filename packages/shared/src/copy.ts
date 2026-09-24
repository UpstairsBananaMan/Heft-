import { STATUS_LABEL } from "./status";
import type { JobStatus } from "./types";

/** Turn a failed request into copy a non-developer can act on. Never includes secrets. */
export function loadFailureCopy(message: string): { title: string; body: string } {
  const offline = /network|offline|fetch|abort|timeout|failed to connect/i.test(message);
  if (offline) {
    return {
      title: "You look offline",
      body: "Heft could not reach the server. Check Wi-Fi, then tap Refresh. Your last action was not saved if this screen stayed empty.",
    };
  }
  return {
    title: "Could not load",
    body: message || "Something went wrong. Tap Refresh and try again.",
  };
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
