import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, serveJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

const ACTIVE = ["assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"];

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, status, customer_id, driver_id")
    .or(`customer_id.eq.${user.id},driver_id.eq.${user.id}`);
  const busy = (jobs ?? []).some((job) => ACTIVE.includes(job.status));
  if (busy) throw new HttpError(409, "Finish or cancel your active delivery first");

  const { data: payouts } = await admin
    .from("payouts")
    .select("id, amount_cents, status")
    .eq("driver_id", user.id)
    .eq("status", "pending");
  const waiting = (payouts ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  if (waiting > 0) throw new HttpError(409, "You have earnings waiting to be paid");

  await admin.from("device_tokens").delete().eq("user_id", user.id);
  await admin.from("driver_documents").delete().eq("driver_id", user.id);
  await admin.from("customer_profiles").delete().eq("user_id", user.id);

  const { error } = await admin
    .from("users")
    .update({ display_name: "Deleted user", phone: null, avatar_url: null })
    .eq("id", user.id);
  if (error) throw new HttpError(500, "We couldn't delete your account");

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) throw new HttpError(500, "We couldn't delete your account");

  return json({ deleted: true });
});
