import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { notifyJobEvent } from "../_shared/notify.ts";
import { QuoteError, computeQuote, publishBlock, requiresSecondPerson, type SizeTier } from "../_shared/pricing.ts";
import { loadPickupRates } from "../_shared/rates.ts";
import { cancelHold, createHold } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/supabase.ts";

const UPDATED = "Your price was updated. Please take a look.";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const phone = user.phone || (typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "");
  if (user.is_anonymous || !user.email || !phone) {
    throw new HttpError(403, "Add your name, email, and phone before booking");
  }
  const body = await readJson(req);
  const jobId = String(body.job_id ?? "");
  if (!jobId) throw new HttpError(400, "job_id is required");

  const { data: job, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw new HttpError(404, "Job not found");
  if (job.customer_id !== user.id) throw new HttpError(403, "Only the customer can publish this job");
  if (job.status === "open" && job.stripe_payment_intent_id) {
    return json({ job, sandbox: String(job.stripe_payment_intent_id).startsWith("pi_sandbox_") });
  }
  if (job.status !== "priced") throw new HttpError(409, "Quote the job before publishing");

  const rates = await loadPickupRates(admin);
  const tier = String(job.size_tier ?? job.size_category ?? "") as SizeTier;
  const pickupFlights = Number(job.stairs_pickup_flights ?? 0);
  const dropoffFlights = Number(job.stairs_dropoff_flights ?? 0);
  const secondPerson =
    requiresSecondPerson({
      itemType: job.item_type,
      size: tier,
      weightBand: job.weight_band,
      pickupFlights,
      dropoffFlights,
    }) || job.needs_second_person === true;
  let quote;
  try {
    quote = computeQuote(
      {
        sizeTier: tier,
        roadMiles: Number(job.billable_miles ?? job.distance_miles ?? 0),
        distanceSource: job.distance_source === "maps" ? "maps" : "estimated",
        pickupInZone: job.pickup_in_zone === true,
        dropoffInZone: job.dropoff_in_zone === true,
        pickupFlights,
        dropoffFlights,
        secondPerson,
        estJobHours: Number(job.est_job_minutes ?? 0) / 60,
        vehicleType: "pickup",
      },
      rates,
    );
  } catch (err) {
    if (err instanceof QuoteError) throw new HttpError(409, UPDATED);
    throw err;
  }
  const savedTotal = Number(job.final_cents ?? job.estimate_cents ?? 0);
  const refused = publishBlock({
    quotedAt: job.quoted_at,
    ratesVersion: job.rates_version,
    expectedRatesVersion: rates.ratesVersion,
    distanceSource: job.distance_source,
    savedTotalCents: savedTotal,
    recomputedTotalCents: quote.totalCents,
    bookable: quote.bookable,
  });
  if (refused) throw new HttpError(409, refused);

  const paymentIntentId = await createHold(savedTotal, job.id);
  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update({
      status: "open",
      needs_second_person: secondPerson,
      final_cents: savedTotal,
      platform_fee_cents: quote.platformFeeCents,
      driver_share_cents: quote.driverShareCents,
      driver_payout_cents: quote.leadDriverKeepsCents,
      lead_payout_cents: quote.leadDriverKeepsCents,
      helper_payout_cents: quote.helperShareCents,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", job.id)
    .eq("status", "priced")
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    await cancelHold(paymentIntentId);
    throw new HttpError(409, "Job could not be published");
  }

  await admin.from("job_events").insert({
    job_id: job.id,
    type: "published",
    actor_id: user.id,
    payload: {
      stripe_payment_intent_id: paymentIntentId,
      sandbox: paymentIntentId.startsWith("pi_sandbox_"),
      final_cents: savedTotal,
    },
  });
  await notifyJobEvent(admin, updated, "open");
  return json({
    job: updated,
    sandbox: paymentIntentId.startsWith("pi_sandbox_"),
    stripe_payment_intent_id: paymentIntentId,
  });
});

