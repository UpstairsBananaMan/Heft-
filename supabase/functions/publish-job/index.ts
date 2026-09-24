import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { splitCents } from "../_shared/pricing.ts";
import { cancelHold, createHold } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const body = await readJson(req);
  const jobId = String(body.job_id ?? "");
  if (!jobId) throw new HttpError(400, "job_id is required");

  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new HttpError(404, "Job not found");
  if (job.customer_id !== user.id) throw new HttpError(403, "Only the customer can publish this job");
  if (job.status === "open" && job.stripe_payment_intent_id) {
    return json({ job, sandbox: String(job.stripe_payment_intent_id).startsWith("pi_sandbox_") });
  }
  if (job.status !== "priced") throw new HttpError(409, "Quote the job before publishing");
  if (!job.estimate_cents || job.estimate_cents < 1) throw new HttpError(409, "Job has no estimate");

  const split = splitCents(job.estimate_cents);
  const paymentIntentId = await createHold(job.estimate_cents, job.id);

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update({
      status: "open",
      final_cents: job.estimate_cents,
      platform_fee_cents: split.platform_fee_cents,
      driver_payout_cents: split.driver_payout_cents,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", job.id)
    .eq("status", "priced")
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    await cancelHold(paymentIntentId);
    throw new HttpError(409, "Job could not be published");
  }

  await admin.from("job_events").insert({
    job_id: job.id,
    type: "published",
    actor_id: user.id,
    payload: {
      stripe_payment_intent_id: paymentIntentId,
      sandbox: paymentIntentId.startsWith("pi_sandbox_"),
      final_cents: job.estimate_cents,
    },
  });
  await notifyJobEvent(admin, updated, "open");

  return json({
    job: updated,
    sandbox: paymentIntentId.startsWith("pi_sandbox_"),
    stripe_payment_intent_id: paymentIntentId,
  });
});
