import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const body = await readJson(req);
  const jobId = String(body.job_id ?? "");
  if (!jobId) throw new HttpError(400, "job_id is required");

  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "driver") throw new HttpError(403, "Only a driver can accept a job");

  const { data, error } = await admin.rpc("accept_job", {
    p_job_id: jobId,
    p_driver_id: user.id,
  });
  if (error) {
    const message = error.message ?? "Could not accept job";
    const status = /no longer open/i.test(message) ? 409 : 400;
    throw new HttpError(status, message.replace(/^.*ERROR:\s*/, "").split("\n")[0]);
  }

  const job = Array.isArray(data) ? data[0] : data;
  if (job) await notifyJobEvent(admin, job, "assigned");
  return json({ job });
});
