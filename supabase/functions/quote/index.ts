import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { routeMiles } from "../_shared/distance.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { inPensacola, quoteLines, splitCents } from "../_shared/pricing.ts";
import { requireUser } from "../_shared/supabase.ts";

const SIZES = new Set(["small", "medium", "large", "xl"]);
const VEHICLES = new Set(["pickup", "cargo_van", "box_truck", "flatbed"]);

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const body = await readJson(req);

  let pickupLat: number;
  let pickupLng: number;
  let dropoffLat: number;
  let dropoffLng: number;
  let size: string;
  let vehicle: string;
  let jobId: string | undefined;

  if (typeof body.job_id === "string") {
    jobId = body.job_id;
    const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
    if (error || !job) throw new HttpError(404, "Job not found");
    if (job.customer_id !== user.id) throw new HttpError(403, "Only the customer can quote this job");
    if (!["draft", "priced"].includes(job.status)) {
      throw new HttpError(409, "Only a draft or priced job can be quoted");
    }
    pickupLat = Number(job.pickup_lat);
    pickupLng = Number(job.pickup_lng);
    dropoffLat = Number(job.dropoff_lat);
    dropoffLng = Number(job.dropoff_lng);
    size = job.size_category;
    vehicle = job.vehicle_required;
  } else {
    pickupLat = Number(body.pickup_lat);
    pickupLng = Number(body.pickup_lng);
    dropoffLat = Number(body.dropoff_lat);
    dropoffLng = Number(body.dropoff_lng);
    size = String(body.size_category ?? "");
    vehicle = String(body.vehicle_required ?? "");
  }

  if (![pickupLat, pickupLng, dropoffLat, dropoffLng].every(Number.isFinite)) {
    throw new HttpError(400, "Pickup and drop-off coordinates are required");
  }
  if (!SIZES.has(size) || !VEHICLES.has(vehicle)) {
    throw new HttpError(400, "Size and vehicle are required");
  }
  if (!inPensacola(pickupLat, pickupLng) || !inPensacola(dropoffLat, dropoffLng)) {
    throw new HttpError(422, "Not in service area yet");
  }

  const distance = await routeMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const { data: rule, error: ruleError } = await admin
    .from("pricing_rules")
    .select("*")
    .eq("market", "pensacola")
    .eq("vehicle_type", vehicle)
    .eq("size_category", size)
    .eq("active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ruleError || !rule) throw new HttpError(404, "No active pricing rule for this vehicle and size");

  const vehicleLabel: Record<string, string> = {
    pickup: "Pickup truck",
    cargo_van: "Cargo van",
    box_truck: "Box truck",
    flatbed: "Flatbed",
  };
  const sizeLabel: Record<string, string> = {
    small: "Small",
    medium: "Medium",
    large: "Large",
    xl: "Extra large",
  };
  let stairs = false;
  let helper = false;
  if (jobId) {
    const { data: extras } = await admin
      .from("jobs")
      .select("stairs_pickup_flights, stairs_dropoff_flights, needs_helper")
      .eq("id", jobId)
      .maybeSingle();
    stairs = Number(extras?.stairs_pickup_flights ?? 0) + Number(extras?.stairs_dropoff_flights ?? 0) > 0;
    helper = extras?.needs_helper === true;
  }
  const breakdown = quoteLines(rule, distance.miles, {
    stairs,
    helper,
    vehicleLabel: vehicleLabel[vehicle] ?? "Pickup truck",
    sizeLabel: sizeLabel[size] ?? "Medium",
  });
  const estimate = breakdown.total_cents;
  const split = splitCents(estimate);
  const result = {
    estimate_cents: estimate,
    total_cents: estimate,
    lines: breakdown.lines,
    distance_miles: distance.miles,
    distance_source: distance.source,
    platform_fee_cents: split.platform_fee_cents,
    driver_payout_cents: split.driver_payout_cents,
    currency: "usd" as const,
    job_id: jobId,
  };

  if (jobId) {
    const { data: updated, error } = await admin
      .from("jobs")
      .update({
        status: "priced",
        distance_miles: distance.miles,
        estimate_cents: estimate,
        final_cents: estimate,
        platform_fee_cents: split.platform_fee_cents,
        driver_payout_cents: split.driver_payout_cents,
        quote_lines: breakdown.lines,
      })
      .eq("id", jobId)
      .in("status", ["draft", "priced"])
      .select("*")
      .maybeSingle();
    if (error || !updated) throw new HttpError(409, "Could not save the quote");
    await admin.from("job_events").insert({
      job_id: jobId,
      type: "priced",
      actor_id: user.id,
      payload: result,
    });
    return json({ ...result, status: updated.status });
  }

  return json(result);
});
