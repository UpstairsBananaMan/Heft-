import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { jwtRole, requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const body = await readJson(req);
  const jobId = String(body.job_id ?? "");
  const event = String(body.event ?? "");
  if (!jobId || !event) throw new HttpError(400, "job_id and event are required");

  const { admin, user } = await requireUser(req);
  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new HttpError(404, "Job not found");

  const role = jwtRole(req);
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const involved = job.customer_id === user.id || job.driver_id === user.id || profile?.role === "admin" || role === "service_role";
  if (!involved) throw new HttpError(403, "Not allowed to notify on this job");

  const result = await notifyJobEvent(admin, job, event);
  return json(result);
});
