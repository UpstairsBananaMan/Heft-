import { HttpError } from "./http.ts";

function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function stripeFetch(path: string, params: Record<string, string>, method = "POST"): Promise<Record<string, unknown>> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new HttpError(500, "Stripe secret is not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : form(params),
  });
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message ?? "Stripe request failed";
    throw new HttpError(402, message);
  }
  return body;
}

export function stripeConfigured(): boolean {
  return Boolean(Deno.env.get("STRIPE_SECRET_KEY"));
}

/** Manual capture hold. Test mode can confirm with pm_card_visa server-side. */
export async function createHold(amountCents: number, jobId: string): Promise<string> {
  if (!stripeConfigured()) return `pi_sandbox_${crypto.randomUUID()}`;
  const intent = await stripeFetch("payment_intents", {
    amount: String(amountCents),
    currency: "usd",
    capture_method: "manual",
    confirm: "true",
    payment_method: "pm_card_visa",
    "metadata[job_id]": jobId,
    description: `Heft job ${jobId}`,
  });
  const id = intent.id;
  if (typeof id !== "string") throw new HttpError(502, "Stripe did not return a PaymentIntent");
  return id;
}

export async function captureHold(paymentIntentId: string): Promise<void> {
  if (!stripeConfigured() || paymentIntentId.startsWith("pi_sandbox_")) return;
  await stripeFetch(`payment_intents/${paymentIntentId}/capture`, {});
}

export async function cancelHold(paymentIntentId: string): Promise<void> {
  if (!stripeConfigured() || paymentIntentId.startsWith("pi_sandbox_")) return;
  await stripeFetch(`payment_intents/${paymentIntentId}/cancel`, {});
}

export async function createTransfer(
  amountCents: number,
  destination: string,
  jobId: string,
): Promise<string> {
  const transfer = await stripeFetch("transfers", {
    amount: String(amountCents),
    currency: "usd",
    destination,
    "metadata[job_id]": jobId,
  });
  const id = transfer.id;
  if (typeof id !== "string") throw new HttpError(502, "Stripe did not return a transfer");
  return id;
}

export async function verifyStripeSignature(raw: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const [k, v] = piece.split("=");
      return [k, v];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${raw}`),
  );
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}
