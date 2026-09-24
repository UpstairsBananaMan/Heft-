"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JOB_STATUSES } from "@heft/shared";
import { requireAdmin } from "./auth";
import { createClient } from "./supabase/server";

function cents(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function signOut() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setDriverStatus(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.configured) return;
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!userId || !["pending", "approved", "suspended"].includes(status)) {
    redirect("/drivers?notice=invalid");
  }
  const { error } = await gate.supabase.from("driver_profiles").update({ status }).eq("user_id", userId);
  if (error) redirect("/drivers?notice=error");
  revalidatePath("/drivers");
  revalidatePath("/");
  redirect(`/drivers?notice=${status}`);
}

export async function updatePricingRule(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.configured) return;
  const id = String(formData.get("id") ?? "");
  const base = cents(formData.get("base_dollars"));
  const perMile = cents(formData.get("per_mile_dollars"));
  const min = cents(formData.get("min_dollars"));
  const size = Number(String(formData.get("size_multiplier") ?? ""));
  if (!id || base == null || perMile == null || min == null || !Number.isFinite(size) || size <= 0) {
    redirect("/pricing?notice=invalid");
  }
  const { error } = await gate.supabase
    .from("pricing_rules")
    .update({
      base_cents: base,
      per_mile_cents: perMile,
      min_cents: min,
      size_multiplier: size,
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) redirect("/pricing?notice=error");
  revalidatePath("/pricing");
  redirect("/pricing?notice=saved");
}

export async function resolveDispute(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.configured) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("resolution_notes") ?? "").trim();
  const allowed = ["open", "investigating", "resolved_customer", "resolved_driver", "closed"];
  const returnTo = safeNext(String(formData.get("return_to") ?? ""), "/disputes");
  if (!id || !allowed.includes(status)) redirect(`${returnTo}?notice=invalid`);
  const resolved = status !== "open" && status !== "investigating";
  const patch: Record<string, string | null> = {
    status,
    resolved_by: resolved ? gate.user.id : null,
    resolved_at: resolved ? new Date().toISOString() : null,
  };
  if (notes) patch.resolution_notes = notes;
  const { error } = await gate.supabase.from("disputes").update(patch).eq("id", id);
  if (error) redirect(`${returnTo}?notice=error`);
  revalidatePath("/disputes");
  revalidatePath("/jobs");
  revalidatePath(returnTo);
  redirect(`${returnTo}?notice=${status}`);
}

function safeNext(raw: string, fallback: string): string {
  const path = raw.split("?")[0];
  if (path === "/disputes" || /^\/jobs\/[0-9a-f-]{36}$/i.test(path)) return path;
  return fallback;
}

export async function restoreDisputedJob(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.configured) return;
  const jobId = String(formData.get("job_id") ?? "");
  if (!jobId) redirect("/jobs?notice=invalid");
  const { data: events } = await gate.supabase
    .from("job_events")
    .select("payload")
    .eq("job_id", jobId)
    .eq("type", "disputed")
    .order("created_at", { ascending: false })
    .limit(1);
  const previous = events?.[0]?.payload?.previous_status;
  if (typeof previous !== "string" || !JOB_STATUSES.includes(previous as (typeof JOB_STATUSES)[number])) {
    redirect(`/jobs/${jobId}?notice=invalid`);
  }
  if (previous === "disputed" || previous === "cancelled") redirect(`/jobs/${jobId}?notice=invalid`);
  const { error } = await gate.supabase.from("jobs").update({ status: previous }).eq("id", jobId).eq("status", "disputed");
  if (error) redirect(`/jobs/${jobId}?notice=error`);
  await gate.supabase.from("job_events").insert({
    job_id: jobId,
    type: "status_restored",
    actor_id: gate.user.id,
    payload: { to: previous, note: "Admin restored status. Payment was not refunded automatically." },
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/disputes");
  redirect(`/jobs/${jobId}?notice=restored`);
}
