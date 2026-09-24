const COPY: Record<string, string> = {
  approved: "Driver approved. They can go online and accept jobs.",
  suspended: "Driver suspended. They cannot accept new jobs.",
  pending: "Driver marked pending.",
  saved: "Pricing rule saved. The next quote uses these amounts.",
  invalid: "That change was rejected. Check the values and try again.",
  error: "The database rejected that change. Nothing was saved.",
  investigating: "Dispute marked investigating. No refund was sent.",
  resolved_customer: "Marked resolved for the customer. This does not refund a payment.",
  resolved_driver: "Marked resolved for the driver. This does not refund a payment.",
  closed: "Dispute closed. No automatic refund was sent.",
  open: "Dispute set back to open.",
  restored: "Job status restored. No refund was sent.",
};

export function Flash({ notice }: { notice?: string }) {
  if (!notice || !COPY[notice]) return null;
  const tone = notice === "error" || notice === "invalid" ? "border-charcoal" : "border-amber";
  return <p className={`mt-4 border ${tone} bg-white px-4 py-3 text-sm`}>{COPY[notice]}</p>;
}
