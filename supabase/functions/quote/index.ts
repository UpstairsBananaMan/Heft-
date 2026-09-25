import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { postalCode, routeMiles } from "../_shared/distance.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyAdmins } from "../_shared/notify.ts";
import {
  ESTIMATED_DISTANCE_ALERT,
  QuoteError,
  canReuseMapsDistance,
  computeQuote,
  coverageDecision,
  estimateJobMinutes,
  normalizeZip,
  requiresSecondPerson,
  type SizeTier,
} from "../_shared/pricing.ts";
import { loadPickupRates } from "../_shared/rates.ts";
import { requireUser } from "../_shared/supabase.ts";

const TIERS = new Set(["small", "medium", "large", "xl", "truckload"]);

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const body = await readJson(req);
  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  if (!jobId) throw new HttpError(400, "job_id is required");

  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new HttpError(404, "Job not found");
  if (job.customer_id !== user.id) throw new HttpError(403, "Only the customer can quote this job");
  if (!["draft", "priced"].includes(job.status)) throw new HttpError(409, "Only a draft or priced job can be quoted");

  const tier = String(job.size_tier ?? job.size_category ?? "");
  if (!TIERS.has(tier)) throw new HttpError(400, "Size is required");

  const pickupLat = Number(job.pickup_lat);
  const pickupLng = Number(job.pickup_lng);
  const dropoffLat = Number(job.dropoff_lat);
  const dropoffLng = Number(job.dropoff_lng);
  const pickupZip = normalizeZip(await postalCode(pickupLat, pickupLng));
  const dropoffZip = normalizeZip(await postalCode(dropoffLat, dropoffLng));
  const { data: zoneRows } = await admin.from("service_zone_zips").select("zip");
  const zoneZips = (zoneRows ?? []).map((row: { zip: string }) => String(row.zip));
  const rates = await loadPickupRates(admin);
  const zoned = coverageDecision({
    pickupZip,
    dropoffZip,
    roadMiles: 0,
    zoneZips,
    maxMiles: rates.maxLoadedMiles,
  });
  if (!zoned.ok && zoned.code !== "TOO_FAR") throw new HttpError(422, zoned.message);

  const reuse = canReuseMapsDistance({
    distance_source: job.distance_source,
    billable_miles: job.billable_miles,
    distance_miles: job.distance_miles,
    quoted_pickup_lat: job.quoted_pickup_lat,
    quoted_pickup_lng: job.quoted_pickup_lng,
    quoted_dropoff_lat: job.quoted_dropoff_lat,
    quoted_dropoff_lng: job.quoted_dropoff_lng,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_lat: dropoffLat,
    dropoff_lng: dropoffLng,
  });
  let roadMiles = Number(job.distance_miles);
  let distanceSource: "maps" | "estimated" = "maps";
  if (!reuse) {
    const distance = await routeMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
    roadMiles = distance.miles;
    distanceSource = distance.source;
  }
  const decision = coverageDecision({
    pickupZip,
    dropoffZip,
    roadMiles,
    zoneZips,
    maxMiles: rates.maxLoadedMiles,
  });
  if (!decision.ok) throw new HttpError(422, decision.message);
  if (distanceSource !== "maps") {
    await admin.from("job_events").insert({
      job_id: jobId,
      type: "distance_estimated",
      actor_id: user.id,
      payload: { road_miles: roadMiles, alert: ESTIMATED_DISTANCE_ALERT },
    });
    await notifyAdmins(admin, ESTIMATED_DISTANCE_ALERT, jobId);
    return json({ error: "distance_unavailable" }, 422);
  }
  const pickupInZone = decision.pickupInZone;
  const dropoffInZone = decision.dropoffInZone;
  const pickupFlights = Number(job.stairs_pickup_flights ?? 0);
  const dropoffFlights = Number(job.stairs_dropoff_flights ?? 0);
  const forced = requiresSecondPerson({
    itemType: job.item_type,
    size: tier,
    weightBand: job.weight_band,
    pickupFlights,
    dropoffFlights,
  });
  const secondPerson = forced || job.needs_second_person === true;
  const minutes = estimateJobMinutes(
    { roadMiles, pickupInZone, dropoffInZone, sizeTier: tier as SizeTier, pickupFlights, dropoffFlights },
    rates,
  );
  let quote;
  try {
    quote = computeQuote(
      {
        sizeTier: tier as SizeTier,
        roadMiles,
        distanceSource: "maps",
        pickupInZone,
        dropoffInZone,
        pickupFlights,
        dropoffFlights,
        secondPerson,
        estJobHours: minutes / 60,
        vehicleType: "pickup",
      },
      rates,
    );
  } catch (err) {
    if (err instanceof QuoteError && (err.code === "OUTSIDE_SERVICE_AREA" || err.code === "TOO_FAR")) {
      throw new HttpError(422, "That's farther than we go right now. We cover trips that start or end around Pensacola, up to 70 miles.");
    }
    throw new HttpError(400, "Could not price this trip");
  }

  const saved = {
    status: "priced",
    size_tier: tier,
    vehicle_required: "pickup",
    needs_second_person: secondPerson,
    distance_miles: roadMiles,
    billable_miles: quote.billableMiles,
    distance_source: "maps",
    pickup_zip: pickupZip,
    dropoff_zip: dropoffZip,
    pickup_in_zone: pickupInZone,
    dropoff_in_zone: dropoffInZone,
    quoted_pickup_lat: pickupLat,
    quoted_pickup_lng: pickupLng,
    quoted_dropoff_lat: dropoffLat,
    quoted_dropoff_lng: dropoffLng,
    est_job_minutes: minutes,
    rates_version: quote.ratesVersion,
    quoted_at: new Date().toISOString(),
    estimate_cents: quote.totalCents,
    final_cents: quote.totalCents,
    platform_fee_cents: quote.platformFeeCents,
    driver_share_cents: quote.driverShareCents,
    driver_payout_cents: quote.leadDriverKeepsCents,
    lead_payout_cents: quote.leadDriverKeepsCents,
    helper_payout_cents: quote.helperShareCents,
    quote_lines: quote.lines,
  };
  const { data: updated, error: saveError } = await admin
    .from("jobs")
    .update(saved)
    .eq("id", jobId)
    .in("status", ["draft", "priced"])
    .select("*")
    .maybeSingle();
  if (saveError || !updated) throw new HttpError(409, "Could not save the quote");
  await admin.from("job_events").insert({
    job_id: jobId,
    type: "priced",
    actor_id: user.id,
    payload: { total_cents: quote.totalCents, rates_version: quote.ratesVersion },
  });
  return json({
    estimate_cents: quote.totalCents,
    total_cents: quote.totalCents,
    lines: quote.lines,
    distance_miles: roadMiles,
    billable_miles: quote.billableMiles,
    distance_source: "maps",
    platform_fee_cents: quote.platformFeeCents,
    driver_payout_cents: quote.leadDriverKeepsCents,
    lead_payout_cents: quote.leadDriverKeepsCents,
    helper_payout_cents: quote.helperShareCents,
    bookable: true,
    currency: "usd" as const,
    job_id: jobId,
    status: updated.status,
  });
});

