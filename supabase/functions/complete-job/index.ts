import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { missingPayouts, payoutsComplete, requiredPayouts, shouldCaptureHold } from "../_shared/pricing.ts";
import { captureHold, createTransfer, paymentIntentStatus, stripeConfigured } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const body = await readJson(req);
  const jobId = String(body.job_id ?? "");
  if (!jobId) throw new HttpError(400, "job_id is required");

  const { data: actor } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new HttpError(404, "Job not found");
  const allowed = (job.driver_id === user.id && actor?.role === "driver") || actor?.role === "admin";
  if (!allowed) throw new HttpError(403, "Only the assigned driver can complete this job");
  if (job.status === "paid") return json({ job, payouts: [] });
  if (job.status !== "delivered") throw new HttpError(409, "Mark the job delivered before completing it");
  const leadCents = Number(job.lead_payout_cents ?? job.driver_payout_cents ?? 0);
  if (job.final_cents == null) throw new HttpError(409, "Job is missing a final price");

  const { count } = await admin.from("job_photos").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("kind", "pod");
  if (!count) throw new HttpError(400, "Proof of delivery is required");
  if (!job.stripe_payment_intent_id) throw new HttpError(409, "No payment hold on this job");

  const required = requiredPayouts(job);
  const { data: existing } = await admin.from("payouts").select("*").eq("job_id", job.id);
  let payouts = existing ?? [];
  const missing = missingPayouts(required, payouts);
  const intentStatus = job.payment_captured_at ? "succeeded" : await paymentIntentStatus(job.stripe_payment_intent_id);
  if (intentStatus === "canceled" || intentStatus === "cancelled") {
    throw new HttpError(409, "The card hold is no longer available");
  }
  if (shouldCaptureHold({ capturedAt: job.payment_captured_at, intentStatus })) {
    await captureHold(job.stripe_payment_intent_id);
    const capturedAt = new Date().toISOString();
    const { error: stampError } = await admin.from("jobs").update({ payment_captured_at: capturedAt }).eq("id", job.id);
    if (stampError) throw new HttpError(500, "Payment was captured but not recorded. Try again.");
    job.payment_captured_at = capturedAt;
  }
  for (const need of missing) {
    try {
      payouts.push(await transferOne(admin, job, need.driverId, need.amountCents, need.role));
    } catch (err) {
      const { data: again } = await admin.from("payouts").select("*").eq("job_id", job.id).eq("driver_id", need.driverId).maybeSingle();
      if (!again) throw err;
      payouts.push(again);
    }
  }
  const { data: fresh } = await admin.from("payouts").select("*").eq("job_id", job.id);
  payouts = fresh ?? payouts;
  if (!payoutsComplete(required, payouts)) {
    throw new HttpError(409, "A payout is still missing. Try again.");
  }

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update({ status: "paid", driver_payout_cents: leadCents })
    .eq("id", job.id)
    .eq("status", "delivered")
    .select("*")
    .maybeSingle();
  if (updateError || !updated) throw new HttpError(409, "Job could not be marked paid");

  await admin.from("job_events").insert({
    job_id: job.id,
    type: "paid",
    actor_id: user.id,
    payload: {
      payout_ids: payouts.map((row: { id: string }) => row.id),
      sandbox: String(job.stripe_payment_intent_id).startsWith("pi_sandbox_"),
      final_cents: job.final_cents,
    },
  });
  await notifyJobEvent(admin, updated, "paid");
  await notifyJobEvent(admin, updated, "payout_available");
  return json({ job: updated, payouts });
});

async function transferOne(
  admin: { from: (table: string) => any },
  job: { id: string },
  driverId: string,
  amount: number,
  role: "lead" | "partner",
) {
  const { data: driver } = await admin.from("driver_profiles").select("stripe_connect_account_id").eq("user_id", driverId).maybeSingle();
  let status: "pending" | "paid" = "pending";
  let transferId: string | null = null;
  const connectId = driver?.stripe_connect_account_id;
  if (stripeConfigured() && connectId && amount > 0) {
    transferId = await createTransfer(amount, connectId, `${job.id}:${role}`);
    status = "paid";
  }
  const inserted = await admin
    .from("payouts")
    .insert({
      driver_id: driverId,
      job_id: job.id,
      amount_cents: amount,
      stripe_transfer_id: transferId,
      status,
      role,
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) throw new HttpError(500, inserted.error?.message ?? "Payout was not recorded");
  return inserted.data;
}
