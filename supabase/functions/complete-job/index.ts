import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { captureHold, createTransfer, stripeConfigured } from "../_shared/stripe.ts";
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
  if (job.status === "paid") return json({ job, payout: null });
  if (job.status !== "delivered") throw new HttpError(409, "Mark the job delivered before completing it");
  if (job.driver_payout_cents == null || job.final_cents == null) {
    throw new HttpError(409, "Job is missing a final price");
  }

  const { count } = await admin
    .from("job_photos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id)
    .eq("kind", "pod");
  if (!count) throw new HttpError(400, "Proof of delivery is required");
  if (!job.stripe_payment_intent_id) throw new HttpError(409, "No payment hold on this job");

  const { data: existingPayout } = await admin
    .from("payouts")
    .select("*")
    .eq("job_id", job.id)
    .maybeSingle();

  let payoutStatus: "pending" | "paid" = "pending";
  let transferId: string | null = null;
  if (!existingPayout) {
    await captureHold(job.stripe_payment_intent_id);
    const { data: driver } = await admin
      .from("driver_profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", job.driver_id)
      .maybeSingle();
    const connectId = driver?.stripe_connect_account_id;
    if (stripeConfigured() && connectId && job.driver_payout_cents > 0) {
      transferId = await createTransfer(job.driver_payout_cents, connectId, job.id);
      payoutStatus = "paid";
    }
  }

  let payout = existingPayout;
  if (!payout) {
    const inserted = await admin
      .from("payouts")
      .insert({
        driver_id: job.driver_id,
        job_id: job.id,
        amount_cents: job.driver_payout_cents,
        stripe_transfer_id: transferId,
        status: payoutStatus,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) throw new HttpError(500, inserted.error?.message ?? "Payout was not recorded");
    payout = inserted.data;
  }
  if (!payout) throw new HttpError(500, "Payout was not recorded");

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update({ status: "paid" })
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
      payout_id: payout.id,
      payout_status: payoutStatus,
      stripe_transfer_id: transferId,
      sandbox: String(job.stripe_payment_intent_id).startsWith("pi_sandbox_"),
    },
  });
  await notifyJobEvent(admin, updated, "paid");
  await notifyJobEvent(admin, updated, "payout_available");
  return json({ job: updated, payout });
});
