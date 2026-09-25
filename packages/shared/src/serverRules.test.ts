import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { neighbourhood } from "./geo";
import { PICKUP_RATES } from "./pricing/computeQuote";
import { SERVICE_ZONE_ZIPS } from "./pricing/zone";
import { APP_NAME } from "./brand";
import brandJson from "../brand.json";
import {
  DISTANCE_UNAVAILABLE,
  ESTIMATED_DISTANCE_ALERT,
  LOCKED_JOB_COLUMNS,
  PRICE_UPDATED,
  canReuseMapsDistance,
  coverageDecision,
  demoPublishBlock,
  inviteBlock,
  invitePushAllowed,
  missingPayouts,
  payoutsComplete,
  protectCustomerJobWrite,
  publishBlock,
  ratesFromCard,
  replacementPartnerPatch,
  requiredPayouts,
  respondBlock,
  shouldCaptureHold,
  twoPersonProgressBlock,
  visiblePartnerPhone,
  zipInListedZone,
} from "./pricing/serverRules";

const root = new URL("../../../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

describe("quote integrity", () => {
  it("reuses maps miles only for the same coordinate pair", () => {
    const saved = {
      distance_source: "maps",
      billable_miles: 10,
      distance_miles: 9.2,
      quoted_pickup_lat: 1,
      quoted_pickup_lng: 2,
      quoted_dropoff_lat: 3,
      quoted_dropoff_lng: 4,
      pickup_lat: 1,
      pickup_lng: 2,
      dropoff_lat: 3,
      dropoff_lng: 4,
    };
    assert.equal(canReuseMapsDistance(saved), true);
    assert.equal(canReuseMapsDistance({ ...saved, dropoff_lat: 9 }), false);
    assert.equal(canReuseMapsDistance({ ...saved, distance_source: "estimated" }), false);
    assert.equal(canReuseMapsDistance({ ...saved, quoted_pickup_lat: null }), false);
  });

  it("ignores a client ZIP and uses the zone table", () => {
    assert.equal(zipInListedZone("32502", SERVICE_ZONE_ZIPS), true);
    assert.equal(zipInListedZone("36602", SERVICE_ZONE_ZIPS), false);
    assert.equal(zipInListedZone("32502", ["36602"]), false);
    const decision = coverageDecision({
      pickupZip: "32502",
      dropoffZip: "36602",
      roadMiles: 60,
      zoneZips: SERVICE_ZONE_ZIPS,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.dropoffInZone, false);
      assert.equal(decision.pickupInZone, true);
    }
    const outside = coverageDecision({
      pickupZip: "36602",
      dropoffZip: "36526",
      roadMiles: 20,
      zoneZips: ["32502"],
    });
    assert.equal(outside.ok, false);
  });

  it("loads every rate field from the card", () => {
    const rates = ratesFromCard(
      {
        ...{
          rates_version: "test-card",
          base_cents: 1111,
          per_mile_cents: 222,
          min_fare_cents: 3333,
          platform_fee_bps: 1500,
          stairs_per_flight_cents: 1500,
          second_person_per_hour_cents: 3000,
          second_person_min_cents: 4500,
          second_person_step_cents: 500,
          out_of_town_per_mile_cents: 175,
          max_loaded_miles: 70,
          max_flights_per_stop: 6,
          est_deadhead_miles: 15,
          est_city_min_per_mile: 2,
          est_highway_min_per_mile: 1.2,
          est_highway_after_miles: 25,
          est_admin_minutes: 10,
          est_minutes_per_flight: 5,
        },
      },
      [{ size_tier: "medium", addon_cents: 999, est_load_minutes: 12 }],
    );
    assert.equal(rates.baseCents, 1111);
    assert.equal(rates.perMileCents, 222);
    assert.equal(rates.ratesVersion, "test-card");
    assert.equal(rates.sizeTierAddonCents.medium, 999);
    assert.notEqual(rates.baseCents, PICKUP_RATES.baseCents);
  });

  it("keeps a customer's pricing columns at the previous values", () => {
    const before = { final_cents: 7900, pickup_address: "Old", needs_second_person: false };
    const next = protectCustomerJobWrite(before, { final_cents: 1, pickup_address: "New", needs_second_person: true, pickup_zip: "99999" });
    assert.equal(next.final_cents, 7900);
    assert.equal(next.needs_second_person, false);
    assert.equal(next.pickup_zip, undefined);
    assert.equal(next.pickup_address, "New");
    const inserted = protectCustomerJobWrite(null, { final_cents: 1, item_description: "Couch" });
    assert.equal("final_cents" in inserted, false);
    assert.equal(inserted.item_description, "Couch");
  });

  it("marks a job paid only after the lead and partner rows both exist", () => {
    const job = {
      driver_id: "lead",
      partner_driver_id: "partner",
      needs_second_person: true,
      lead_payout_cents: 8000,
      helper_payout_cents: 3800,
    };
    const required = requiredPayouts(job);
    assert.equal(required.length, 2);
    const leadOnly = [{ driver_id: "lead", role: "lead" }];
    assert.equal(payoutsComplete(required, leadOnly), false);
    assert.equal(missingPayouts(required, leadOnly).map((row) => row.role).join(","), "partner");
    assert.equal(payoutsComplete(required, [...leadOnly, { driver_id: "partner", role: "partner" }]), true);
  });

  it("names the neighbourhood outside Pensacola", () => {
    assert.equal(neighbourhood("21 E Government St, Pensacola, FL"), "Downtown");
    assert.equal(neighbourhood("150 Government St, Mobile, AL"), "Mobile");
  });
});

describe("partner guards", () => {
  it("lets only an approved lead invite", () => {
    assert.equal(inviteBlock({ status: "approved", partner_only: true }, false), "Only an approved lead can invite a partner");
    assert.equal(inviteBlock({ status: "pending", partner_only: false }, false), "Only an approved lead can invite a partner");
    assert.equal(inviteBlock({ status: "approved", partner_only: false }, true), "You are partnered today");
    assert.equal(inviteBlock({ status: "approved", partner_only: false }, false), null);
  });

  it("refuses an invitee who is already on a job, already partnered, or not ready", () => {
    const ready = {
      inviteeHasLeadJob: false,
      inviteeHasAcceptedPartner: false,
      inviteeHasPendingOutgoing: false,
      approved: true,
      backgroundChecked: true,
      payoutsReady: true,
    };
    assert.equal(respondBlock({ ...ready, inviteeHasLeadJob: true }), "Finish your current job first");
    assert.equal(respondBlock({ ...ready, inviteeHasAcceptedPartner: true }), "You already have a partner for today");
    assert.equal(respondBlock({ ...ready, inviteeHasPendingOutgoing: true }), "You already have a partner for today");
    assert.equal(respondBlock({ ...ready, payoutsReady: false }), "You need to be approved with a background check and payouts set up");
    assert.equal(respondBlock({ ...ready, backgroundChecked: false }), "You need to be approved with a background check and payouts set up");
    assert.equal(respondBlock(ready), null);
  });

  it("blocks a 2-person job from leaving accepted without a partner", () => {
    assert.equal(twoPersonProgressBlock({ needs_second_person: true, partner_driver_id: null, partner_lost_at: null }, "en_route_pickup"), "Add a partner before continuing this job");
    assert.equal(twoPersonProgressBlock({ needs_second_person: true, partner_driver_id: "p", partner_lost_at: "2026-09-24T12:00:00Z" }, "at_pickup"), "Add a partner before continuing this job");
    assert.equal(twoPersonProgressBlock({ needs_second_person: true, partner_driver_id: "p", partner_lost_at: null }, "en_route_pickup"), null);
    assert.equal(twoPersonProgressBlock({ needs_second_person: false, partner_driver_id: null, partner_lost_at: null }, "en_route_pickup"), null);
  });

  it("puts the new partner on the job and clears the back-out clock", () => {
    assert.deepEqual(replacementPartnerPatch("partner-2"), { partner_driver_id: "partner-2", partner_lost_at: null });
  });
});

describe("real path wiring", () => {
  it("ships a coverage function that geocodes and checks the zone table", () => {
    const coverage = source("supabase/functions/coverage/index.ts");
    assert.match(coverage, /postalCode/);
    assert.match(coverage, /service_zone_zips/);
    assert.match(coverage, /coverageDecision/);
    assert.doesNotMatch(coverage, /body\.pickup_zip/);
  });

  it("quotes from geocoded ZIPs and caches miles per coordinate pair", () => {
    const quote = source("supabase/functions/quote/index.ts");
    assert.match(quote, /postalCode/);
    assert.match(quote, /canReuseMapsDistance/);
    assert.match(quote, /service_zone_zips/);
    assert.match(quote, /loadPickupRates/);
    assert.match(quote, /notifyAdmins/);
    assert.match(quote, /ESTIMATED_DISTANCE_ALERT/);
    assert.match(ESTIMATED_DISTANCE_ALERT, /estimate and cannot be booked/);
    assert.doesNotMatch(quote, /zipInZone\(/);
    assert.doesNotMatch(quote, /job\.pickup_zip/);
  });

  it("publishes with the same rate loader as quote", () => {
    const publish = source("supabase/functions/publish-job/index.ts");
    assert.match(publish, /loadPickupRates/);
    assert.doesNotMatch(publish, /activeRates/);
  });

  it("completes each payout role before marking the job paid", () => {
    const complete = source("supabase/functions/complete-job/index.ts");
    const guard = complete.indexOf("payoutsComplete");
    const paid = complete.indexOf('status: "paid"');
    assert.ok(guard > 0 && paid > guard);
    assert.match(complete, /missingPayouts/);
  });

  it("locks pricing columns and lets a partner end or replace", () => {
    const sql = source("supabase/migrations/20260927120000_quote_integrity.sql");
    for (const column of LOCKED_JOB_COLUMNS) assert.match(sql, new RegExp(column));
    assert.match(sql, /protect_job_pricing/);
    assert.match(sql, /revoke update/);
    assert.match(sql, /partner_id = auth.uid\(\)/);
    assert.match(sql, /partner_lost_at = null/);
    assert.match(sql, /Finish your current job first/);
    assert.match(sql, /Only an approved lead can invite a partner/);
    assert.match(sql, /release_partner_job/);
  });

  it("blocks status moves in the real function", () => {
    const status = source("supabase/functions/update-job-status/index.ts");
    assert.match(status, /twoPersonProgressBlock/);
  });

  it("sends the partner invite push with the partnership id", () => {
    const notify = source("supabase/functions/notify/index.ts");
    const shared = source("supabase/functions/_shared/notify.ts");
    assert.match(notify, /partnership_id/);
    assert.match(notify, /partner-invite/);
    assert.match(notify, /invitePushAllowed/);
    assert.doesNotMatch(notify, /title: "Heft"/);
    assert.doesNotMatch(shared, /title: "Heft"/);
    assert.match(notify, /APP_NAME/);
    assert.match(shared, /APP_NAME/);
    assert.equal(APP_NAME, brandJson.appName);
  });

  it("refuses an estimated distance on the real publish path", () => {
    const now = Date.parse("2026-09-24T18:00:00.000Z");
    const fresh = {
      quotedAt: "2026-09-24T17:30:00.000Z",
      ratesVersion: PICKUP_RATES.ratesVersion,
      expectedRatesVersion: PICKUP_RATES.ratesVersion,
      savedTotalCents: 7900,
      recomputedTotalCents: 7900,
      bookable: true,
      nowMs: now,
    };
    assert.equal(publishBlock({ ...fresh, distanceSource: "maps" }), null);
    assert.equal(publishBlock({ ...fresh, distanceSource: "estimated" }), PRICE_UPDATED);
    assert.equal(publishBlock({ ...fresh, distanceSource: "estimated", bookable: false }), PRICE_UPDATED);
    assert.equal(demoPublishBlock({ ...fresh, distanceSource: "estimated", allowEstimated: false }), PRICE_UPDATED);
    assert.equal(demoPublishBlock({ ...fresh, distanceSource: "estimated", allowEstimated: true }), null);
    const publish = source("supabase/functions/publish-job/index.ts");
    assert.match(publish, /publishBlock/);
    assert.doesNotMatch(publish, /allowEstimated|demoPublishBlock/);
    const where = source("apps/mobile/app/(customer)/where.tsx");
    assert.doesNotMatch(where, /You can still book in this demo/);
    assert.doesNotMatch(where, /Estimated demo distance/);
    assert.match(where, /demoMode/);
    assert.match(where, /DISTANCE_UNAVAILABLE/);
    assert.match(DISTANCE_UNAVAILABLE, /Try again/);
    const quote = source("supabase/functions/quote/index.ts");
    assert.match(quote, /DISTANCE_UNAVAILABLE/);
  });

  it("skips a second card capture and masks partner phones", () => {
    assert.equal(shouldCaptureHold({ capturedAt: null, intentStatus: "requires_capture" }), true);
    assert.equal(shouldCaptureHold({ capturedAt: "2026-09-24T18:00:00.000Z", intentStatus: "requires_capture" }), false);
    assert.equal(shouldCaptureHold({ capturedAt: null, intentStatus: "succeeded" }), false);
    const complete = source("supabase/functions/complete-job/index.ts");
    assert.ok(complete.indexOf("shouldCaptureHold") < complete.indexOf("captureHold"));
    assert.match(complete, /paymentIntentStatus/);
    assert.match(complete, /payment_captured_at/);
    assert.equal(visiblePartnerPhone({ callerIsLead: false, currentInvite: true, phone: "8505550199" }), null);
    assert.equal(visiblePartnerPhone({ callerIsLead: true, currentInvite: true, phone: "8505550199" }), "8505550199");
    assert.equal(visiblePartnerPhone({ callerIsLead: true, currentInvite: false, phone: "8505550199" }), "0199");
    const now = Date.parse("2026-09-24T18:00:00.000Z");
    assert.equal(invitePushAllowed({ status: "declined", invite_pushed_at: null }, now), false);
    assert.equal(invitePushAllowed({ status: "pending", invite_pushed_at: null }, now), true);
    assert.equal(invitePushAllowed({ status: "pending", invite_pushed_at: "2026-09-24T17:55:00.000Z" }, now), false);
  });

  it("reads partners through an RPC and lets a customer see a new draft", () => {
    const sql = source("supabase/migrations/20260928120000_partner_read_and_capture.sql");
    assert.match(sql, /my_partnerships/);
    assert.match(sql, /partnership_detail/);
    assert.match(sql, /jobs_select_own/);
    assert.match(sql, /customer_id = auth\.uid\(\)/);
    assert.match(sql, /grant insert/);
    assert.match(sql, /grant update/);
    assert.match(sql, /revoke insert, update on table public\.jobs from authenticated/);
    assert.match(sql, /No job to release/);
    assert.match(sql, /background_check_at is null/);
    assert.match(sql, /You already have a partner for today/);
    for (const file of [
      "apps/mobile/app/(driver)/(tabs)/map.tsx",
      "apps/mobile/src/components/PartnerSheet.tsx",
      "apps/mobile/app/(driver)/invite/[id].tsx",
    ]) {
      const text = source(file);
      assert.doesNotMatch(text, /partner:users|lead:users/);
    }
    assert.match(source("apps/mobile/app/(driver)/(tabs)/map.tsx"), /my_partnerships/);
    assert.match(source("apps/mobile/app/(driver)/invite/[id].tsx"), /partnership_detail/);
    assert.match(source("apps/mobile/app/(customer)/(tabs)/home.tsx"), /billableMiles/);
    assert.doesNotMatch(source("apps/mobile/app/(customer)/(tabs)/home.tsx"), /haversineMiles/);
  });
});
