import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const raw = await req.text();
  if (!secret) {
    return json({
      received: false,
      sandbox: true,
      message: "STRIPE_WEBHOOK_SECRET is not set. Sandbox jobs complete inside complete-job and do not need this webhook.",
    });
  }
  const valid = await verifyStripeSignature(raw, req.headers.get("stripe-signature"));
  if (!valid) return json({ error: "Invalid Stripe signature" }, 400);

  const event = JSON.parse(raw);
  const admin = adminClient();
  const type = String(event.type ?? "");
  const object = event.data?.object ?? {};
  const jobId = object.metadata?.job_id as string | undefined;

  if (type === "payment_intent.succeeded" && jobId) {
    await admin.from("job_events").insert({
      job_id: jobId,
      type: "stripe_payment_succeeded",
      payload: { payment_intent: object.id ?? null },
    });
  }

  if (type === "payment_intent.payment_failed" && jobId) {
    await admin.from("job_events").insert({
      job_id: jobId,
      type: "stripe_payment_failed",
      payload: { payment_intent: object.id ?? null },
    });
  }

  if ((type === "transfer.paid" || type === "transfer.created") && object.id) {
    const status = type === "transfer.paid" ? "paid" : undefined;
    if (status) {
      await admin.from("payouts").update({ status }).eq("stripe_transfer_id", object.id);
    }
  }

  if (type === "charge.refunded" && jobId) {
    await admin.from("job_events").insert({
      job_id: jobId,
      type: "stripe_refunded",
      payload: { charge: object.id ?? null },
    });
  }

  return json({ received: true });
});
