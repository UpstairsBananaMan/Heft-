import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { postalCode, routeMiles } from "../_shared/distance.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import {
  PICKUP_RATES,
  QuoteError,
  computeQuote,
  estimateJobMinutes,
  normalizeZip,
  requiresSecondPerson,
  zipInZone,
  type Rates,
  type SizeTier,
} from "../_shared/pricing.ts";
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

  let pickupZip = normalizeZip(job.pickup_zip);
  let dropoffZip = normalizeZip(job.dropoff_zip);
  if (!pickupZip) pickupZip = normalizeZip(await postalCode(Number(job.pickup_lat), Number(job.pickup_lng)));
  if (!dropoffZip) dropoffZip = normalizeZip(await postalCode(Number(job.dropoff_lat), Number(job.dropoff_lng)));
  if (!pickupZip || !dropoffZip) {
    throw new HttpError(422, "We couldn't pin down that address. Try adding the street number, or pick a suggestion from the list.");
  }

  const pickupInZone = zipInZone(pickupZip);
  const dropoffInZone = zipInZone(dropoffZip);
  if (!pickupInZone && !dropoffInZone) {
    throw new HttpError(422, "That's farther than we go right now. We cover trips that start or end around Pensacola, up to 70 miles.");
  }

  const reuse = job.distance_source === "maps" && job.quoted_at && Number.isFinite(Number(job.billable_miles));
  let roadMiles = Number(job.distance_miles);
  let distanceSource: "maps" | "estimated" = "maps";
  if (!reuse || !Number.isFinite(roadMiles)) {
    const distance = await routeMiles(Number(job.pickup_lat), Number(job.pickup_lng), Number(job.dropoff_lat), Number(job.dropoff_lng));
    roadMiles = distance.miles;
    distanceSource = distance.source;
  }
  if (distanceSource !== "maps") {
    await admin.from("job_events").insert({
      job_id: jobId,
      type: "distance_estimated",
      actor_id: user.id,
      payload: { road_miles: roadMiles },
    });
    return json({ error: "distance_unavailable" }, 422);
  }

  const rates = await loadRates(admin);
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

async function loadRates(admin: { from: (table: string) => any }): Promise<Rates> {
  const { data } = await admin.from("rate_cards").select("*").eq("active", true).eq("vehicle_type", "pickup").limit(1).maybeSingle();
  if (!data) return PICKUP_RATES;
  const { data: tiers } = await admin.from("size_tier_rates").select("*").eq("rate_card_id", data.id);
  const sizeTierAddonCents = { ...PICKUP_RATES.sizeTierAddonCents };
  const estLoadMinutes = { ...PICKUP_RATES.estLoadMinutes };
  for (const row of tiers ?? []) {
    if (row.size_tier in sizeTierAddonCents) {
      sizeTierAddonCents[row.size_tier as SizeTier] = Number(row.addon_cents);
      estLoadMinutes[row.size_tier as SizeTier] = Number(row.est_load_minutes);
    }
  }
  return {
    ratesVersion: data.rates_version,
    baseCents: data.base_cents,
    perMileCents: data.per_mile_cents,
    minFareCents: data.min_fare_cents,
    platformFeeBps: data.platform_fee_bps,
    sizeTierAddonCents,
    stairsPerFlightCents: data.stairs_per_flight_cents,
    secondPersonPerHourCents: data.second_person_per_hour_cents,
    secondPersonMinCents: data.second_person_min_cents,
    secondPersonStepCents: data.second_person_step_cents,
    outOfTownPerMileCents: data.out_of_town_per_mile_cents,
    maxLoadedMiles: data.max_loaded_miles,
    maxFlightsPerStop: data.max_flights_per_stop,
    estDeadheadMiles: Number(data.est_deadhead_miles),
    estCityMinPerMile: Number(data.est_city_min_per_mile),
    estHighwayMinPerMile: Number(data.est_highway_min_per_mile),
    estHighwayAfterMiles: Number(data.est_highway_after_miles),
    estLoadMinutes,
    estAdminMinutes: data.est_admin_minutes,
    estMinutesPerFlight: data.est_minutes_per_flight,
  };
}
