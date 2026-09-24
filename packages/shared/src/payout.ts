export type PayoutPhase = "needs_setup" | "pending" | "paid";

/** Paid wins. Setup must exist before a transfer can be "on its way". */
export function payoutPhase(input: { setupComplete: boolean; status?: string | null }): PayoutPhase {
  if (input.status === "paid") return "paid";
  if (!input.setupComplete) return "needs_setup";
  return "pending";
}

export function payoutCaption(phase: PayoutPhase): string {
  if (phase === "paid") return "Paid";
  if (phase === "needs_setup") return "Set up payouts to get this";
  return "On its way to your account";
}

export function payoutAnnounce(amount: string, phase: PayoutPhase): string {
  if (phase === "paid") return `${amount} paid`;
  if (phase === "needs_setup") return `${amount}. Set up payouts to get this`;
  return `${amount} on its way to your account`;
}
