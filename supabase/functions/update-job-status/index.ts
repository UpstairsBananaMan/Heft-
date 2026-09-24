import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { transitionAllowed } from "../_shared/status.ts";
import { cancelHold } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const body = await readJson(req);
  const jobId = String(body.job_id ?? "");
  const next = String(body.status ?? "");
  const cancelReason = typeof body.cancel_reason === "string" ? body.cancel_reason.trim() : "";
  if (!jobId || !next) throw new HttpError(400, "job_id and status are required");

  const { data: actor } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const role = actor?.role ?? "";
  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new HttpError(404, "Job not found");

  const isCustomer = job.customer_id === user.id && role === "customer";
  const isDriver = job.driver_id === user.id && role === "driver";
  const isAdmin = role === "admin";
  if (!isCustomer && !isDriver && !isAdmin) throw new HttpError(403, "Not allowed to update this job");
  if (next === "paid") throw new HttpError(400, "Use complete-job to capture payment");
  if (!transitionAllowed(job.status, next, role)) {
    throw new HttpError(409, `Cannot move from ${job.status} to ${next}`);
  }
  if (next === "cancelled" && cancelReason.length < 3) {
    throw new HttpError(400, "A cancel reason is required");
  }
  if (next === "delivered") {
    const { count } = await admin
      .from("job_photos")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job.id)
      .eq("kind", "pod");
    if (!count) throw new HttpError(400, "Upload proof of delivery before marking delivered");
  }

  const patch: Record<string, unknown> = { status: next };
  if (next === "at_pickup") patch.picked_up_at = new Date().toISOString();
  if (next === "delivered") patch.delivered_at = new Date().toISOString();
  if (next === "cancelled") {
    patch.cancelled_at = new Date().toISOString();
    patch.cancel_reason = cancelReason;
  }

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update(patch)
    .eq("id", job.id)
    .eq("status", job.status)
    .select("*")
    .maybeSingle();
  if (updateError || !updated) throw new HttpError(409, "Status changed before this update");

  if (next === "cancelled" && job.stripe_payment_intent_id) {
    await cancelHold(job.stripe_payment_intent_id);
  }

  await admin.from("job_events").insert({
    job_id: job.id,
    type: next,
    actor_id: user.id,
    payload: { from: job.status, to: next, cancel_reason: cancelReason || null },
  });
  await notifyJobEvent(admin, updated, next);
  return json({ job: updated });
});
