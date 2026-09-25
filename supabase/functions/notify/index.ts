import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { APP_NAME } from "../../../packages/shared/src/brand.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { invitePushAllowed } from "../_shared/pricing.ts";
import { jwtRole, requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const body = await readJson(req);
  const partnershipId = String(body.partnership_id ?? "");
  if (partnershipId) {
    const { admin, user } = await requireUser(req);
    const { data: row } = await admin
      .from("driver_partnerships")
      .select("id, lead_id, partner_id, status, invite_pushed_at")
      .eq("id", partnershipId)
      .maybeSingle();
    if (!row || row.lead_id !== user.id) throw new HttpError(403, "Not allowed to notify on this invite");
    if (!invitePushAllowed(row)) return json({ sent: 0 });
    const pushedAt = new Date().toISOString();
    const { data: stamped } = await admin
      .from("driver_partnerships")
      .update({ invite_pushed_at: pushedAt })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!stamped) return json({ sent: 0 });
    const { data: lead } = await admin.from("users").select("display_name").eq("id", user.id).maybeSingle();
    const first = String(lead?.display_name ?? "A driver").split(" ")[0];
    const { data: tokens } = await admin.from("device_tokens").select("token").eq("user_id", row.partner_id);
    const messages = (tokens ?? []).map((tokenRow: { token: string }) => ({
      to: tokenRow.token,
      title: APP_NAME,
      body: `${first} added you as their partner today. Your share is paid to you directly.`,
      data: { partnership_id: row.id, event: "partner_invite" },
      sound: "default",
      categoryId: "partner-invite",
    }));
    if (messages.length === 0) return json({ sent: 0 });
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    return json({ sent: res.ok ? messages.length : 0 });
  }
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
