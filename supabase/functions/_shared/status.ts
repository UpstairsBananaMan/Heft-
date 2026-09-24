/** Keep in sync with packages/shared/src/status.ts */

const DRIVER_NEXT: Record<string, string> = {
  assigned: "en_route_pickup",
  en_route_pickup: "at_pickup",
  at_pickup: "en_route_dropoff",
  en_route_dropoff: "at_dropoff",
  at_dropoff: "delivered",
};

const CUSTOMER_CANCEL = new Set(["draft", "priced", "open", "assigned", "en_route_pickup"]);
const DRIVER_CANCEL = new Set(["assigned", "en_route_pickup"]);

export function transitionAllowed(from: string, to: string, role: string): boolean {
  if (to === "cancelled") {
    if (role === "customer") return CUSTOMER_CANCEL.has(from);
    if (role === "driver") return DRIVER_CANCEL.has(from);
    if (role === "admin") return !["cancelled", "paid", "draft"].includes(from);
    return false;
  }
  if (role !== "driver" && role !== "admin") return false;
  return DRIVER_NEXT[from] === to;
}
