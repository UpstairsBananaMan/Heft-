/**
 * Local stub. Events are names and enums only — never email, phone, address, or free text.
 * A later pass can forward these to a product analytics vendor.
 */
export type AnalyticsEvent =
  | { name: "signup_completed"; role: "customer" | "driver" }
  | { name: "quote_requested" }
  | { name: "job_published"; sandbox: boolean }
  | { name: "job_accepted" }
  | { name: "job_cancelled"; role: "customer" | "driver"; from_status: string }
  | { name: "dispute_opened" }
  | { name: "pod_uploaded" };

export function track(event: AnalyticsEvent): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info("[heft]", event.name);
  }
}
