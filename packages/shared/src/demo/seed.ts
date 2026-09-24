import type { DemoState } from "./types";

export const DEMO_IDS = {
  admin: "a0000000-0000-4000-8000-000000000001",
  customer: "b0000000-0000-4000-8000-000000000002",
  driver: "c0000000-0000-4000-8000-000000000003",
  pendingDriver: "c0000000-0000-4000-8000-000000000013",
  openJob: "d0000000-0000-4000-8000-000000000010",
  activeJob: "d0000000-0000-4000-8000-000000000011",
  dropoffJob: "d0000000-0000-4000-8000-000000000012",
  paidTable: "d0000000-0000-4000-8000-000000000014",
  paidMattress: "d0000000-0000-4000-8000-000000000015",
  disputedJob: "d0000000-0000-4000-8000-000000000016",
  dispute: "e0000000-0000-4000-8000-000000000021",
} as const;

const VEHICLES = [
  ["pickup", 4500, 250, 5500],
  ["cargo_van", 5500, 300, 7000],
  ["box_truck", 8500, 400, 11000],
  ["flatbed", 9500, 450, 12500],
] as const;

const SIZES = [
  ["small", 1],
  ["medium", 1.15],
  ["large", 1.35],
  ["xl", 1.6],
] as const;

function user(id: string, role: string, name: string, phone: string, now: string) {
  return {
    id,
    role,
    display_name: name,
    phone,
    avatar_url: null,
    stripe_customer_id: null,
    created_at: now,
    updated_at: now,
  };
}

export function createDemoState(now = new Date().toISOString()): DemoState {
  const rules = VEHICLES.flatMap(([vehicle, base, perMile, min]) =>
    SIZES.map(([size, mult]) => ({
      id: `rule-${vehicle}-${size}`,
      market: "pensacola",
      vehicle_type: vehicle,
      size_category: size,
      base_cents: base,
      per_mile_cents: perMile,
      min_cents: min,
      size_multiplier: mult,
      active: true,
      effective_from: now,
    })),
  );

  return {
    users: [
      user(DEMO_IDS.admin, "admin", "Demo Admin", "8505550100", now),
      user(DEMO_IDS.customer, "customer", "Demo Customer", "8505550101", now),
      user(DEMO_IDS.driver, "driver", "Demo Driver", "8505550102", now),
      user(DEMO_IDS.pendingDriver, "driver", "Demo Pending Driver", "8505550103", now),
    ],
    customer_profiles: [
      {
        user_id: DEMO_IDS.customer,
        default_address: "21 E Government St, Pensacola, FL",
        default_lat: 30.4088,
        default_lng: -87.2166,
        rating_avg: 4.9,
        rating_count: 2,
      },
    ],
    driver_profiles: [
      {
        user_id: DEMO_IDS.driver,
        status: "approved",
        vehicle_type: "pickup",
        capacity_lbs: 1500,
        bed_length_ft: 6,
        service_lat: 30.4213,
        service_lng: -87.2169,
        service_radius_miles: 25,
        stripe_connect_account_id: null,
        rating_avg: 5,
        rating_count: 2,
        is_online: true,
        current_lat: 30.4213,
        current_lng: -87.2169,
        last_seen_at: now,
      },
      {
        user_id: DEMO_IDS.pendingDriver,
        status: "pending",
        vehicle_type: "cargo_van",
        capacity_lbs: 2000,
        bed_length_ft: 8,
        service_lat: 30.4213,
        service_lng: -87.2169,
        service_radius_miles: 20,
        stripe_connect_account_id: null,
        rating_avg: 0,
        rating_count: 0,
        is_online: false,
        current_lat: null,
        current_lng: null,
        last_seen_at: null,
      },
    ],
    jobs: [
      job(DEMO_IDS.openJob, "open", "Demo — dresser, waiting for a driver", 30.4088, -87.2166, "21 E Government St, Pensacola, FL", 30.4758, -87.208, "5100 N 9th Ave, Pensacola, FL", null, 7000, now),
      job(DEMO_IDS.activeJob, "en_route_pickup", "Demo — lumber bundle, driver on the way", 30.436, -87.191, "1200 E Gadsden St, Pensacola, FL", 30.4733, -87.1867, "2430 Airport Blvd, Pensacola, FL", DEMO_IDS.driver, 8200, now),
      job(DEMO_IDS.dropoffJob, "at_dropoff", "Demo — fridge at the drop-off", 30.421, -87.283, "4100 W Fairfield Dr, Pensacola, FL", 30.4088, -87.2166, "21 E Government St, Pensacola, FL", DEMO_IDS.driver, 9600, now),
      job(DEMO_IDS.paidTable, "paid", "Demo — dining table, paid sample", 30.4088, -87.2166, "21 E Government St, Pensacola, FL", 30.436, -87.191, "1200 E Gadsden St, Pensacola, FL", DEMO_IDS.driver, 7000, now),
      job(DEMO_IDS.paidMattress, "paid", "Demo — mattress, paid sample", 30.4758, -87.208, "5100 N 9th Ave, Pensacola, FL", 30.421, -87.283, "4100 W Fairfield Dr, Pensacola, FL", DEMO_IDS.driver, 12000, now),
      job(DEMO_IDS.disputedJob, "disputed", "Demo — bookshelf, open dispute", 30.4733, -87.1867, "2430 Airport Blvd, Pensacola, FL", 30.4088, -87.2166, "21 E Government St, Pensacola, FL", DEMO_IDS.driver, 8800, now),
    ],
    job_events: [
      event("ev-open", DEMO_IDS.openJob, "open", DEMO_IDS.customer, now, { seed: "demo" }),
      event("ev-active", DEMO_IDS.activeJob, "en_route_pickup", DEMO_IDS.driver, now, { from: "assigned", to: "en_route_pickup", seed: "demo" }),
      event("ev-drop", DEMO_IDS.dropoffJob, "at_dropoff", DEMO_IDS.driver, now, { from: "en_route_dropoff", to: "at_dropoff", seed: "demo" }),
      event("ev-paid-1", DEMO_IDS.paidTable, "paid", DEMO_IDS.driver, now, { seed: "demo" }),
      event("ev-paid-2", DEMO_IDS.paidMattress, "paid", DEMO_IDS.driver, now, { seed: "demo" }),
      event("ev-dispute", DEMO_IDS.disputedJob, "disputed", DEMO_IDS.customer, now, { previous_status: "delivered", seed: "demo" }),
    ],
    job_photos: [],
    disputes: [
      {
        id: DEMO_IDS.dispute,
        job_id: DEMO_IDS.disputedJob,
        opened_by: DEMO_IDS.customer,
        reason: "Demo dispute — the bookshelf arrived with a cracked shelf. Sample only.",
        status: "open",
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        created_at: now,
      },
    ],
    payouts: [
      payout("po-1", DEMO_IDS.paidTable, 5950, now),
      payout("po-2", DEMO_IDS.paidMattress, 10200, now),
    ],
    pricing_rules: rules,
    ratings: [],
    device_tokens: [],
  };
}

function job(
  id: string,
  status: string,
  item: string,
  pickupLat: number,
  pickupLng: number,
  pickup: string,
  dropLat: number,
  dropLng: number,
  dropoff: string,
  driverId: string | null,
  cents: number,
  now: string,
) {
  const fee = Math.round(cents * 0.15);
  return {
    id,
    customer_id: DEMO_IDS.customer,
    driver_id: driverId,
    status,
    pickup_address: pickup,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    pickup_notes: null,
    dropoff_address: dropoff,
    dropoff_lat: dropLat,
    dropoff_lng: dropLng,
    dropoff_notes: null,
    item_description: item,
    size_category: "medium",
    vehicle_required: "pickup",
    distance_miles: 4.5,
    estimate_cents: cents,
    final_cents: cents,
    platform_fee_cents: fee,
    driver_payout_cents: cents - fee,
    stripe_payment_intent_id: status === "draft" || status === "priced" ? null : `pi_sandbox_demo_${id.slice(0, 8)}`,
    scheduled_at: null,
    accepted_at: driverId ? now : null,
    picked_up_at: null,
    delivered_at: status === "paid" || status === "disputed" ? now : null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: now,
    updated_at: now,
  };
}

function event(id: string, jobId: string, type: string, actor: string, now: string, payload: Record<string, unknown>) {
  return { id, job_id: jobId, type, actor_id: actor, payload, created_at: now };
}

function payout(id: string, jobId: string, amount: number, now: string) {
  return {
    id,
    job_id: jobId,
    driver_id: DEMO_IDS.driver,
    amount_cents: amount,
    status: "pending",
    created_at: now,
  };
}
