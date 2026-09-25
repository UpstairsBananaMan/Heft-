import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.8";
import { APP_NAME } from "../../../packages/shared/src/brand.ts";
import { haversineMiles, vehicleCovers } from "./pricing.ts";

type JobRow = {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  vehicle_required: string;
  item_description?: string;
};

const COPY: Record<string, string> = {
  open: "New open job in your service area",
  published: "New open job in your service area",
  accepted: "A driver accepted your job",
  assigned: "A driver accepted your job",
  en_route_pickup: "Driver is en route to pickup",
  at_pickup: "Driver is at pickup",
  en_route_dropoff: "Driver is en route to drop-off",
  at_dropoff: "Driver is at drop-off",
  delivered: "Delivery marked complete",
  paid: "Job paid",
  cancelled: "Job cancelled",
  disputed: "A dispute was opened",
  payout_available: "Payout recorded for a completed job",
};

async function recipientIds(admin: SupabaseClient, job: JobRow, event: string): Promise<string[]> {
  if (event === "open" || event === "published") {
    const { data: drivers } = await admin
      .from("driver_profiles")
      .select("user_id, status, is_online, vehicle_type, service_lat, service_lng, service_radius_miles")
      .eq("status", "approved")
      .eq("is_online", true);
    const ids: string[] = [];
    for (const driver of drivers ?? []) {
      if (!vehicleCovers(driver.vehicle_type, job.vehicle_required)) continue;
      const miles = haversineMiles(
        Number(driver.service_lat),
        Number(driver.service_lng),
        Number(job.pickup_lat),
        Number(job.pickup_lng),
      );
      if (miles <= Number(driver.service_radius_miles)) ids.push(driver.user_id);
    }
    return ids;
  }
  if (event === "payout_available") return job.driver_id ? [job.driver_id] : [];
  const ids = [job.customer_id];
  if (job.driver_id) ids.push(job.driver_id);
  return ids;
}

export async function notifyJobEvent(
  admin: SupabaseClient,
  job: JobRow,
  event: string,
): Promise<{ sent: number }> {
  try {
    const userIds = await recipientIds(admin, job, event);
    if (userIds.length === 0) return { sent: 0 };
    const { data: tokens } = await admin
      .from("device_tokens")
      .select("token")
      .in("user_id", userIds);
    const messages = (tokens ?? []).map((row) => ({
      to: row.token,
      title: APP_NAME,
      body: COPY[event] ?? `Job update: ${event}`,
      data: { job_id: job.id, event },
      sound: "default",
    }));
    // No tokens means no request. Tokens are saved only after an Expo project id exists.
    if (messages.length === 0) return { sent: 0 };
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.warn("Expo push failed", res.status);
      return { sent: 0 };
    }
    return { sent: messages.length };
  } catch (err) {
    console.warn("notify failed", err);
    return { sent: 0 };
  }
}

export async function notifyAdmins(
  admin: SupabaseClient,
  message: string,
  jobId: string,
): Promise<{ sent: number }> {
  try {
    const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
    const ids = (admins ?? []).map((row: { id: string }) => row.id);
    if (ids.length === 0) return { sent: 0 };
    const { data: tokens } = await admin.from("device_tokens").select("token").in("user_id", ids);
    const messages = (tokens ?? []).map((row: { token: string }) => ({
      to: row.token,
      title: APP_NAME,
      body: message,
      data: { job_id: jobId, event: "distance_estimated" },
      sound: "default",
    }));
    if (messages.length === 0) return { sent: 0 };
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) return { sent: 0 };
    return { sent: messages.length };
  } catch (err) {
    console.warn("admin alert failed", err);
    return { sent: 0 };
  }
}
