import { PICKUP_RATES, QuoteError, computeQuote, estimateJobMinutes, type SizeTier } from "../pricing/computeQuote";
import { demoTrip, type TripEnd } from "../pricing/demoTrip";
import { requiresSecondPerson } from "../pricing/secondPerson";
import { chicagoDate, phoneDigits } from "../pricing/clock";
import {
  PRICE_UPDATED,
  demoPublishBlock,
  inviteBlock,
  leadJobInProgress,
  missingPayouts,
  payoutsComplete,
  protectCustomerJobWrite,
  replacementPartnerPatch,
  requiredPayouts,
  respondBlock,
  shouldCaptureHold,
  twoPersonProgressBlock,
  visiblePartnerPhone,
} from "../pricing/serverRules";
import { canCancel, nextDriverStatus } from "../status";
import type { JobStatus, Role } from "../types";
import { createDemoState } from "./seed";
import type { DemoRequest, DemoResult, DemoRow, DemoState } from "./types";

const TABLES = [
  "users",
  "customer_profiles",
  "driver_profiles",
  "jobs",
  "job_events",
  "job_photos",
  "disputes",
  "payouts",
  "pricing_rules",
  "ratings",
  "device_tokens",
  "driver_documents",
  "feed_posts",
  "driver_partnerships",
  "service_zone_zips",
  "rate_cards",
  "size_tier_rates",
] as const;

type TableName = (typeof TABLES)[number];

function isTable(name: string): name is TableName {
  return (TABLES as readonly string[]).includes(name);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function id(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fail(state: DemoState, message: string, statusNote?: string): { state: DemoState; result: DemoResult } {
  return { state, result: { data: null, error: { message: statusNote ?? message }, count: null } };
}

function ok(state: DemoState, data: unknown, count: number | null = null): { state: DemoState; result: DemoResult } {
  return { state, result: { data, error: null, count } };
}

function rowsOf(state: DemoState, table: TableName): DemoRow[] {
  return state[table];
}

function visible(state: DemoState, table: TableName, rows: DemoRow[], actor: DemoRequest["actor"]): DemoRow[] {
  if (table === "feed_posts" && actor?.role !== "admin") return rows.filter((row) => row.status === "approved");
  if (!actor || actor.role === "admin") return rows;
  if (table === "jobs" && actor.role === "customer") return rows.filter((row) => row.customer_id === actor.id);
  if (table === "jobs" && actor.role === "driver") return rows.filter((row) => driverCanSeeJob(state, row, actor.id));
  if (table === "payouts" && actor.role === "driver") return rows.filter((row) => row.driver_id === actor.id);
  if (table === "driver_partnerships") return rows.filter((row) => row.lead_id === actor.id || row.partner_id === actor.id);
  if (table === "users") return rows.filter((row) => row.id === actor.id);
  return rows;
}

function driverCanSeeJob(state: DemoState, row: DemoRow, driverId: string): boolean {
  if (row.partner_driver_id === driverId) return true;
  if (row.driver_id === driverId && row.status !== "open") return true;
  if (row.status !== "open") return false;
  const profile = state.driver_profiles.find((item) => item.user_id === driverId);
  if (profile?.partner_only === true) return false;
  if (acceptedAsPartner(state, driverId)) return false;
  return true;
}

function activePartnership(state: DemoState, leadId: string, now = new Date()) {
  const today = chicagoDate(now);
  return state.driver_partnerships.find(
    (row) => row.lead_id === leadId && row.status === "accepted" && row.shift_date === today,
  );
}

function acceptedAsPartner(state: DemoState, userId: string, now = new Date()) {
  const today = chicagoDate(now);
  return state.driver_partnerships.find(
    (row) => row.partner_id === userId && row.status === "accepted" && row.shift_date === today,
  );
}

function matches(row: DemoRow, filters: { op: string; column: string; value: unknown }[]): boolean {
  return filters.every((filter) => {
    const value = row[filter.column];
    if (filter.op === "eq") return value === filter.value;
    if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(value);
    if (filter.op === "gte") return value != null && String(value) >= String(filter.value);
    return true;
  });
}

function splitSelect(select: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const char of select) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += char;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function embedRows(state: DemoState, row: DemoRow, token: string): unknown {
  const match = /^(?:(\w+):)?(\w+)(?:!([a-z0-9_]+))?\(([^)]*)\)$/i.exec(token);
  if (!match) return undefined;
  const alias = match[1] || match[2];
  const table = match[2];
  const hint = match[3] ?? "";
  const cols = match[4].split(",").map((part) => part.trim()).filter(Boolean);
  if (!isTable(table)) return null;
  const stripped = hint.replace(/_fkey$/, "");
  const fk = stripped.includes("_") ? stripped.slice(stripped.indexOf("_") + 1) : "";
  let found: DemoRow[] = [];
  if (fk && row[fk] != null) found = rowsOf(state, table).filter((item) => item.id === row[fk]);
  else if (table === "users" && row.user_id != null) found = state.users.filter((item) => item.id === row.user_id);
  else if (table === "jobs" && row.job_id != null) found = state.jobs.filter((item) => item.id === row.job_id);
  else if (table === "customer_profiles") found = state.customer_profiles.filter((item) => item.user_id === row.id);
  else if (alias === "customer" && row.customer_id != null) found = state.users.filter((item) => item.id === row.customer_id);
  else if (alias === "driver" && row.driver_id != null) found = state.users.filter((item) => item.id === row.driver_id);
  else if (alias === "partner" && row.partner_id != null) found = state.users.filter((item) => item.id === row.partner_id);
  else if (alias === "lead" && row.lead_id != null) found = state.users.filter((item) => item.id === row.lead_id);
  const projected = found.map((item) => {
    if (cols.length === 0 || cols.includes("*")) return item;
    const pick: DemoRow = {};
    for (const col of cols) pick[col] = item[col];
    return pick;
  });
  if (table === "customer_profiles") return projected[0] ?? null;
  return projected[0] ?? null;
}

function project(state: DemoState, row: DemoRow, select?: string): DemoRow {
  if (!select || select.trim() === "*") return { ...row };
  const parts = splitSelect(select);
  const includeAll = parts.includes("*");
  const result: DemoRow = includeAll ? { ...row } : {};
  for (const part of parts) {
    if (part === "*") continue;
    if (part.includes("(")) {
      const head = part.slice(0, part.indexOf("("));
      const alias = head.split(":")[0].split("!")[0];
      result[alias] = embedRows(state, row, part);
      continue;
    }
    result[part] = row[part];
  }
  return result;
}

function sortRows(rows: DemoRow[], orders: { column: string; ascending: boolean }[]): DemoRow[] {
  if (orders.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const av = a[order.column];
      const bv = b[order.column];
      if (av === bv) continue;
      const cmp = String(av ?? "") < String(bv ?? "") ? -1 : 1;
      return order.ascending ? cmp : -cmp;
    }
    return 0;
  });
}

function canMove(from: string, to: string, role: Role): boolean {
  if (to === "cancelled") return canCancel(from as JobStatus, role);
  if (to === "delivered") return from === "at_dropoff" && (role === "driver" || role === "admin");
  if (role !== "driver" && role !== "admin") return false;
  return nextDriverStatus(from as JobStatus) === to;
}

export function applyDemo(input: DemoState, request: DemoRequest): { state: DemoState; result: DemoResult } {
  const state = clone(input);
  if (!Array.isArray(state.feed_posts)) state.feed_posts = createDemoState().feed_posts;
  if (request.kind === "invoke") return applyInvoke(state, request);
  if (!isTable(request.table)) return fail(state, `Unknown table ${request.table}`);
  const table = request.table;
  const filters = request.filters ?? [];
  const actor = request.actor;

  if (request.action === "select") {
    let rows = visible(state, table, rowsOf(state, table), actor).filter((row) => matches(row, filters));
    rows = sortRows(rows, request.orders ?? []);
    if (request.limit) rows = rows.slice(0, request.limit);
    const count = request.count === "exact" ? rows.length : null;
    if (request.head) return ok(state, null, count);
    const data = rows.map((row) => project(state, row, request.select));
    if (request.single === "maybe") {
      if (data.length > 1) return fail(state, "Multiple rows");
      return ok(state, data[0] ?? null, count);
    }
    if (request.single === "one") {
      if (data.length !== 1) return fail(state, data.length === 0 ? "No row" : "Multiple rows");
      return ok(state, data[0], count);
    }
    return ok(state, data, count);
  }

  if (request.action === "insert") {
    const incoming = Array.isArray(request.payload) ? request.payload : [request.payload ?? {}];
    const created = incoming.map((row) => {
      const clean = table === "jobs" && actor?.role === "customer" ? protectCustomerJobWrite(null, row) : row;
      return decorateInsert(table, clean);
    });
    if (table === "disputes") {
      for (const row of created) openDispute(state, row);
    }
    state[table].push(...created);
    const projected = created.map((row) => project(state, row, request.select));
    if (request.single === "one" || request.single === "maybe") return ok(state, projected[0] ?? null);
    if (request.select) return ok(state, projected);
    return ok(state, created);
  }

  if (request.action === "update") {
    const patch = (Array.isArray(request.payload) ? request.payload[0] : request.payload) ?? {};
    let changed = 0;
    state[table] = rowsOf(state, table).map((row) => {
      if (!matches(row, filters)) return row;
      changed += 1;
      const nextPatch = table === "jobs" && actor?.role === "customer" ? protectCustomerJobWrite(row, patch) : patch;
      return { ...row, ...nextPatch, updated_at: new Date().toISOString() };
    });
    if (changed === 0 && request.single) return fail(state, "No row");
    return ok(state, null);
  }

  if (request.action === "upsert") {
    const row = (Array.isArray(request.payload) ? request.payload[0] : request.payload) ?? {};
    const keys = (request.onConflict ?? "id").split(",").map((key) => key.trim());
    const index = rowsOf(state, table).findIndex((existing) => keys.every((key) => existing[key] === row[key]));
    if (index >= 0) state[table][index] = { ...state[table][index], ...row, updated_at: new Date().toISOString() };
    else state[table].push(decorateInsert(table, row));
    return ok(state, null);
  }

  return fail(state, "Unsupported action");
}

function decorateInsert(table: TableName, row: DemoRow): DemoRow {
  const now = new Date().toISOString();
  const next = { ...row };
  if (table !== "driver_profiles" && table !== "customer_profiles" && next.id == null) next.id = id();
  if (next.created_at == null) next.created_at = now;
  if (next.updated_at == null) next.updated_at = now;
  return next;
}

function openDispute(state: DemoState, row: DemoRow) {
  const job = state.jobs.find((item) => item.id === row.job_id);
  if (!job || job.status === "disputed") return;
  const previous = job.status;
  job.status = "disputed";
  job.updated_at = new Date().toISOString();
  state.job_events.push({
    id: id(),
    job_id: job.id,
    type: "disputed",
    actor_id: row.opened_by ?? null,
    payload: { previous_status: previous, seed: "demo" },
    created_at: new Date().toISOString(),
  });
}

function applyInvoke(state: DemoState, request: Extract<DemoRequest, { kind: "invoke" }>): { state: DemoState; result: DemoResult } {
  const actor = request.actor;
  const body = request.body ?? {};
  const jobId = String(body.job_id ?? "");
  const job = state.jobs.find((item) => item.id === jobId);

  if (request.name === "assigned_driver_card") {
    const cardJob = state.jobs.find((item) => item.id === String(body.job_id ?? ""));
    if (!cardJob?.driver_id) return ok(state, null);
    const person = state.users.find((item) => item.id === cardJob.driver_id);
    const profile = state.driver_profiles.find((item) => item.user_id === cardJob.driver_id);
    const partnerPerson = cardJob.partner_driver_id ? state.users.find((item) => item.id === cardJob.partner_driver_id) : undefined;
    const partnerProfile = cardJob.partner_driver_id ? state.driver_profiles.find((item) => item.user_id === cardJob.partner_driver_id) : undefined;
    const docs = state.driver_documents.filter((item) => item.driver_id === cardJob.driver_id);
    const licenseOk = docs.some((item) => item.kind === "license" && item.status === "approved");
    const insuranceOk = docs.some((item) => item.kind === "insurance" && item.status === "approved");
    return ok(state, {
      display_name: person?.display_name ?? "Driver",
      phone: person?.phone ?? null,
      avatar_url: person?.avatar_url ?? null,
      rating_avg: profile?.rating_avg ?? 0,
      rating_count: profile?.rating_count ?? 0,
      vehicle_color: profile?.vehicle_color ?? null,
      vehicle_make: profile?.vehicle_make ?? null,
      vehicle_model: profile?.vehicle_model ?? null,
      vehicle_type: profile?.vehicle_type ?? null,
      plate: profile?.plate ?? null,
      status: profile?.status ?? "pending",
      approved_documents: Boolean(licenseOk && (profile?.partner_only ? true : insuranceOk) && profile?.status === "approved"),
      partner_display_name: partnerPerson?.display_name ?? null,
      partner_first_name: partnerPerson ? String(partnerPerson.display_name).split(" ")[0] : null,
      partner_avatar_url: partnerPerson?.avatar_url ?? null,
      partner_approved: partnerProfile?.status === "approved",
    });
  }
  if (request.name === "delete-account") {
    if (!actor) return fail(state, "Sign in first");
    const busy = state.jobs.some(
      (item) =>
        (item.customer_id === actor.id || item.driver_id === actor.id) &&
        ["assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"].includes(String(item.status)),
    );
    if (busy) return fail(state, "Finish or cancel your active delivery first");
    const person = state.users.find((item) => item.id === actor.id);
    if (person) {
      person.display_name = "Deleted user";
      person.phone = null;
      person.avatar_url = null;
    }
    return ok(state, { deleted: true });
  }
  if (request.name === "notify") return ok(state, { sent: 0 });
  if (request.name === "connect-onboarding") {
    return ok(state, {
      sandbox: true,
      url: null,
      message: "Demo mode. Payout setup is a sample. No Stripe account is created.",
    });
  }
  if (!actor) return fail(state, "Sign in first");

  if (request.name === "coverage") {
    const trip = coverTrip(body);
    if (!trip.ok) return fail(state, coverageMessage(trip.error));
    return ok(state, trip);
  }
  if (request.name === "my_partnerships") return ok(state, myPartnerships(state, actor.id));
  if (request.name === "partnership_detail") {
    const rows = myPartnerships(state, actor.id);
    return ok(state, rows.find((row) => row.id === String(body.p_id ?? "")) ?? null);
  }
  if (request.name === "invite_partner") return invitePartner(state, actor.id, String(body.phone ?? ""));
  if (request.name === "reinvite_partner") return reinvitePartner(state, actor.id, String(body.p_partner_id ?? ""));
  if (request.name === "respond_partner") return respondPartner(state, actor.id, String(body.p_id ?? body.partnership_id ?? ""), body.p_accept !== false && body.accept !== false);
  if (request.name === "end_partnership") return endPartnership(state, actor.id);
  if (request.name === "simulate-partner-backout") return simulateBackout(state, actor.id);
  if (request.name === "skip-partner-deadline" || request.name === "release-job" || request.name === "release_partner_job") {
    return releasePartnerWindow(state, actor.id);
  }

  if (!job) return fail(state, "Job not found");

  if (request.name === "quote") {
    if (job.customer_id !== actor.id) return fail(state, "Only the customer can quote this job");
    if (job.status !== "draft" && job.status !== "priced") return fail(state, "Only a draft or priced job can be quoted");
    const trip = coverTrip({
      pickup_lat: job.pickup_lat,
      pickup_lng: job.pickup_lng,
      pickup_address: job.pickup_address,
      dropoff_lat: job.dropoff_lat,
      dropoff_lng: job.dropoff_lng,
      dropoff_address: job.dropoff_address,
    });
    if (!trip.ok) return fail(state, coverageMessage(trip.error));
    const tier = String(job.size_tier ?? job.size_category ?? "medium") as SizeTier;
    const pickupFlights = Number(job.stairs_pickup_flights ?? 0);
    const dropoffFlights = Number(job.stairs_dropoff_flights ?? 0);
    const second =
      requiresSecondPerson({
        itemType: String(job.item_type ?? ""),
        size: tier,
        weightBand: job.weight_band ? String(job.weight_band) : null,
        pickupFlights,
        dropoffFlights,
      }) || job.needs_second_person === true;
    const minutes = estimateJobMinutes({
      roadMiles: trip.roadMiles,
      pickupInZone: trip.pickupInZone,
      dropoffInZone: trip.dropoffInZone,
      sizeTier: tier,
      pickupFlights,
      dropoffFlights,
    });
    const quoteDistance = trip.distanceSource === "estimated" ? "estimated" : "maps";
    let quote;
    try {
      quote = computeQuote({
        sizeTier: tier,
        roadMiles: trip.roadMiles,
        distanceSource: quoteDistance,
        pickupInZone: trip.pickupInZone,
        dropoffInZone: trip.dropoffInZone,
        pickupFlights,
        dropoffFlights,
        secondPerson: second,
        estJobHours: minutes / 60,
        vehicleType: "pickup",
      });
    } catch (err) {
      if (err instanceof QuoteError) return fail(state, coverageMessage(err.code === "TOO_FAR" || err.code === "OUTSIDE_SERVICE_AREA" ? err.code : "OUTSIDE_SERVICE_AREA"));
      throw err;
    }
    Object.assign(job, {
      status: "priced",
      size_tier: tier,
      vehicle_required: "pickup",
      needs_second_person: second,
      distance_miles: trip.roadMiles,
      billable_miles: quote.billableMiles,
      distance_source: trip.distanceSource,
      quoted_pickup_lat: job.pickup_lat,
      quoted_pickup_lng: job.pickup_lng,
      quoted_dropoff_lat: job.dropoff_lat,
      quoted_dropoff_lng: job.dropoff_lng,
      pickup_zip: trip.pickupZip,
      dropoff_zip: trip.dropoffZip,
      pickup_in_zone: trip.pickupInZone,
      dropoff_in_zone: trip.dropoffInZone,
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
      updated_at: new Date().toISOString(),
    });
    state.job_events.push({
      id: id(),
      job_id: job.id,
      type: "priced",
      actor_id: actor.id,
      payload: { seed: "demo", distance_source: trip.distanceSource, total_cents: quote.totalCents },
      created_at: new Date().toISOString(),
    });
    return ok(state, {
      estimate_cents: quote.totalCents,
      total_cents: quote.totalCents,
      lines: quote.lines,
      distance_miles: trip.roadMiles,
      distance_source: trip.distanceSource,
      distance_label: trip.distanceLabel,
      platform_fee_cents: quote.platformFeeCents,
      driver_payout_cents: quote.leadDriverKeepsCents,
      lead_payout_cents: quote.leadDriverKeepsCents,
      helper_payout_cents: quote.helperShareCents,
      bookable: trip.distanceSource === "estimated" ? true : quote.bookable,
      sandbox: true,
      status: "priced",
    });
  }

  if (request.name === "publish-job") {
    if (job.customer_id !== actor.id) return fail(state, "Only the customer can publish this job");
    if (job.status !== "priced") return fail(state, "Quote the job before publishing");
    const refused = publishRefusal(job);
    if (refused) return fail(state, refused);
    job.status = "open";
    job.stripe_payment_intent_id = `pi_sandbox_${id()}`;
    job.final_cents = job.estimate_cents;
    job.updated_at = new Date().toISOString();
    state.job_events.push({
      id: id(),
      job_id: job.id,
      type: "open",
      actor_id: actor.id,
      payload: { seed: "demo" },
      created_at: new Date().toISOString(),
    });
    return ok(state, { sandbox: true, job });
  }

  if (request.name === "accept-job") {
    if (actor.role !== "driver") return fail(state, "Only a driver can accept");
    const profile = state.driver_profiles.find((item) => item.user_id === actor.id);
    if (!profile || profile.status !== "approved" || profile.is_online !== true) return fail(state, "Go online with an approved vehicle first");
    if (profile.partner_only === true) return fail(state, "partner-only accounts cannot accept jobs as a lead");
    if (acceptedAsPartner(state, actor.id)) return fail(state, "You're partnered today");
    if (job.status !== "open") return fail(state, "This job was already taken");
    let partnerId: string | null = null;
    if (job.needs_second_person === true) {
      const partnership = activePartnership(state, actor.id);
      if (!partnership) return fail(state, "Add a partner first");
      partnerId = String(partnership.partner_id);
    }
    job.status = "assigned";
    job.driver_id = actor.id;
    job.partner_driver_id = partnerId;
    job.partner_lost_at = null;
    job.accepted_at = new Date().toISOString();
    job.updated_at = job.accepted_at;
    state.job_events.push({
      id: id(),
      job_id: job.id,
      type: "assigned",
      actor_id: actor.id,
      payload: { from: "open", to: "assigned", seed: "demo" },
      created_at: job.accepted_at as string,
    });
    return ok(state, { job });
  }

  if (request.name === "update-job-status") {
    const next = String(body.status ?? "");
    const partnerBlock = twoPersonProgressBlock(job, next);
    if (partnerBlock) return fail(state, partnerBlock);
    if (!canMove(String(job.status), next, actor.role)) return fail(state, `Cannot move from ${job.status} to ${next}`);
    if (next === "cancelled" && String(body.cancel_reason ?? "").trim().length < 3) return fail(state, "A cancel reason is required");
    if (next === "delivered") {
      const pods = state.job_photos.filter((photo) => photo.job_id === job.id && photo.kind === "pod").length;
      if (pods < 1) return fail(state, "Upload proof of delivery before marking delivered");
    }
    const from = job.status;
    job.status = next;
    job.updated_at = new Date().toISOString();
    if (next === "cancelled") {
      job.cancel_reason = String(body.cancel_reason ?? "");
      job.cancelled_at = job.updated_at;
    }
    if (next === "delivered") job.delivered_at = job.updated_at;
    state.job_events.push({
      id: id(),
      job_id: job.id,
      type: next,
      actor_id: actor.id,
      payload: { from, to: next, cancel_reason: body.cancel_reason ?? null, seed: "demo" },
      created_at: job.updated_at,
    });
    return ok(state, { job });
  }

  if (request.name === "complete-job") {
    if (job.driver_id !== actor.id && actor.role !== "admin") return fail(state, "Only the assigned driver can complete this job");
    if (job.status !== "delivered") return fail(state, "Mark the job delivered first");
    const pods = state.job_photos.filter((photo) => photo.job_id === job.id && photo.kind === "pod").length;
    if (pods < 1) return fail(state, "Upload proof of delivery before completing");
    const required = requiredPayouts({
      driver_id: job.driver_id ? String(job.driver_id) : null,
      partner_driver_id: job.partner_driver_id ? String(job.partner_driver_id) : null,
      needs_second_person: job.needs_second_person === true,
      lead_payout_cents: Number(job.lead_payout_cents ?? job.driver_payout_cents ?? 0),
      helper_payout_cents: Number(job.helper_payout_cents ?? 0),
    });
    const existing = state.payouts.filter((payout) => payout.job_id === job.id);
    const missing = missingPayouts(
      required,
      existing.map((row) => ({ driver_id: row.driver_id ? String(row.driver_id) : null, role: row.role ? String(row.role) : null })),
    );
    const nowPaid = new Date().toISOString();
    const capturedAt = job.payment_captured_at ? String(job.payment_captured_at) : null;
    if (shouldCaptureHold({ capturedAt, intentStatus: capturedAt ? "succeeded" : "requires_capture" })) {
      job.payment_captured_at = nowPaid;
    }
    for (const need of missing) {
      state.payouts.push({
        id: id(),
        job_id: job.id,
        driver_id: need.driverId,
        amount_cents: need.amountCents,
        role: need.role,
        status: "pending",
        stripe_transfer_id: `tr_sandbox_${id()}`,
        created_at: nowPaid,
      });
    }
    const after = state.payouts.filter((payout) => payout.job_id === job.id);
    if (
      !payoutsComplete(
        required,
        after.map((row) => ({ driver_id: row.driver_id ? String(row.driver_id) : null, role: row.role ? String(row.role) : null })),
      )
    ) {
      return fail(state, "A payout is still missing. Try again.");
    }
    job.status = "paid";
    job.updated_at = nowPaid;
    job.driver_payout_cents = Number(job.lead_payout_cents ?? job.driver_payout_cents ?? 0);
    state.job_events.push({
      id: id(),
      job_id: job.id,
      type: "paid",
      actor_id: actor.id,
      payload: { seed: "demo", sandbox: true },
      created_at: job.updated_at as string,
    });
    return ok(state, { sandbox: true, job });
  }

  return fail(state, `Unknown function ${request.name}`);
}

const FAR = "That's farther than we go right now. We cover trips that start or end around Pensacola, up to 70 miles.";
const NO_ZIP = "We couldn't pin down that address. Try adding the street number, or pick a suggestion from the list.";

function coverageMessage(code: string): string {
  if (code === "NO_ZIP") return NO_ZIP;
  return FAR;
}

function inferZip(lat: number, lng: number, address: string): string | null {
  if (/without a street|unpinned|no zip/i.test(address)) return null;
  if (Math.abs(lat - 30.6954) < 0.05 && Math.abs(lng + 88.0399) < 0.05) return "36602";
  if (Math.abs(lat - 30.6035) < 0.05 && Math.abs(lng + 87.9036) < 0.05) return "36526";
  if (lat >= 30.1 && lat <= 30.7 && lng >= -87.6 && lng <= -86.9) return "32502";
  return null;
}

function coverTrip(body: Record<string, unknown>) {
  const pickup: TripEnd = {
    lat: Number(body.pickup_lat),
    lng: Number(body.pickup_lng),
    address: String(body.pickup_address ?? ""),
    zip: inferZip(Number(body.pickup_lat), Number(body.pickup_lng), String(body.pickup_address ?? "")),
  };
  const dropoff: TripEnd = {
    lat: Number(body.dropoff_lat),
    lng: Number(body.dropoff_lng),
    address: String(body.dropoff_address ?? ""),
    zip: inferZip(Number(body.dropoff_lat), Number(body.dropoff_lng), String(body.dropoff_address ?? "")),
  };
  return demoTrip(pickup, dropoff);
}

function publishRefusal(job: DemoRow): string | null {
  const source = String(job.distance_source ?? "");
  const tier = String(job.size_tier ?? job.size_category ?? "medium") as SizeTier;
  try {
    const quote = computeQuote({
      sizeTier: tier,
      roadMiles: Number(job.billable_miles ?? job.distance_miles ?? 0),
      distanceSource: source === "estimated" ? "estimated" : "maps",
      pickupInZone: job.pickup_in_zone === true,
      dropoffInZone: job.dropoff_in_zone === true,
      pickupFlights: Number(job.stairs_pickup_flights ?? 0),
      dropoffFlights: Number(job.stairs_dropoff_flights ?? 0),
      secondPerson: job.needs_second_person === true,
      estJobHours: Number(job.est_job_minutes ?? 0) / 60,
      vehicleType: "pickup",
    });
    return demoPublishBlock({
      quotedAt: job.quoted_at ? String(job.quoted_at) : null,
      ratesVersion: job.rates_version ? String(job.rates_version) : null,
      expectedRatesVersion: PICKUP_RATES.ratesVersion,
      distanceSource: source,
      savedTotalCents: Number(job.final_cents ?? job.estimate_cents ?? 0),
      recomputedTotalCents: quote.totalCents,
      bookable: quote.bookable,
      allowEstimated: true,
    });
  } catch {
    return PRICE_UPDATED;
  }
}

function firstName(name: unknown): string {
  return String(name ?? "").split(" ")[0] ?? "";
}

function myPartnerships(state: DemoState, callerId: string) {
  const today = chicagoDate();
  return state.driver_partnerships
    .filter((row) => row.lead_id === callerId || row.partner_id === callerId)
    .map((row) => {
      const lead = state.users.find((user) => user.id === row.lead_id);
      const partner = state.users.find((user) => user.id === row.partner_id);
      const currentInvite = row.lead_id === callerId && row.shift_date === today && (row.status === "pending" || row.status === "accepted");
      return {
        id: String(row.id),
        lead_id: String(row.lead_id),
        partner_id: String(row.partner_id),
        status: String(row.status),
        shift_date: String(row.shift_date ?? ""),
        lead_first_name: firstName(lead?.display_name),
        lead_avatar_url: (lead?.avatar_url as string | null) ?? null,
        partner_first_name: firstName(partner?.display_name),
        partner_avatar_url: (partner?.avatar_url as string | null) ?? null,
        phone: visiblePartnerPhone({
          callerIsLead: row.lead_id === callerId,
          currentInvite,
          phone: partner?.phone ? String(partner.phone) : null,
        }),
      };
    });
}

function reinvitePartner(state: DemoState, leadId: string, partnerId: string) {
  const prior = state.driver_partnerships.some((row) => row.lead_id === leadId && row.partner_id === partnerId);
  if (!prior) return fail(state, "No past partnership with that driver");
  const person = state.users.find((user) => user.id === partnerId);
  return invitePartner(state, leadId, String(person?.phone ?? ""));
}

function invitePartner(state: DemoState, leadId: string, phone: string) {
  const leadProfile = state.driver_profiles.find((row) => row.user_id === leadId);
  const blocked = inviteBlock(
    leadProfile ? { status: String(leadProfile.status ?? ""), partner_only: leadProfile.partner_only === true } : null,
    Boolean(acceptedAsPartner(state, leadId)),
  );
  if (blocked) return fail(state, blocked);
  const digits = phoneDigits(phone);
  const person = state.users.find((user) => phoneDigits(String(user.phone ?? "")) === digits);
  if (!person || digits.length < 10) return ok(state, { status: "no_account" });
  if (person.id === leadId) return fail(state, "You cannot be your own partner");
  const profile = state.driver_profiles.find((row) => row.user_id === person.id);
  const name = String(person.display_name ?? "Driver");
  if (!profile || profile.status !== "approved" || !profile.background_check_at) {
    return ok(state, { status: "pending_approval", name });
  }
  if (!profile.stripe_connect_account_id) return ok(state, { status: "no_payouts", name });
  const today = chicagoDate();
  if (state.driver_partnerships.some((row) => row.lead_id === leadId && row.shift_date === today && (row.status === "pending" || row.status === "accepted"))) {
    return fail(state, "You already have a partner for today");
  }
  const partnershipId = id();
  state.driver_partnerships.push({
    id: partnershipId,
    lead_id: leadId,
    partner_id: person.id,
    shift_date: today,
    status: "pending",
    invited_at: new Date().toISOString(),
    responded_at: null,
    ended_at: null,
    ended_by: null,
  });
  return ok(state, {
    status: "invited",
    partnership_id: partnershipId,
    name,
    auto_accept: digits === "8505550199",
  });
}

function respondPartner(state: DemoState, actorId: string, partnershipId: string, accept: boolean) {
  const row = state.driver_partnerships.find((item) => item.id === partnershipId);
  if (!row) return fail(state, "Invite not found");
  if (row.partner_id !== actorId && row.lead_id !== actorId) return fail(state, "not allowed");
  if (row.status !== "pending" || (row.shift_date && row.shift_date !== chicagoDate())) {
    return fail(state, "This invite is no longer open");
  }
  if (accept) {
    const today = chicagoDate();
    const profile = state.driver_profiles.find((item) => item.user_id === row.partner_id);
    const blocked = respondBlock({
      inviteeHasLeadJob: state.jobs.some((job) => job.driver_id === row.partner_id && leadJobInProgress(String(job.status))),
      inviteeHasAcceptedPartner: state.driver_partnerships.some(
        (item) =>
          item.id !== row.id &&
          item.shift_date === today &&
          item.status === "accepted" &&
          (item.lead_id === row.partner_id || item.partner_id === row.partner_id),
      ),
      inviteeHasPendingOutgoing: state.driver_partnerships.some(
        (item) => item.id !== row.id && item.shift_date === today && item.status === "pending" && item.lead_id === row.partner_id,
      ),
      approved: profile?.status === "approved",
      backgroundChecked: Boolean(profile?.background_check_at),
      payoutsReady: Boolean(profile?.stripe_connect_account_id),
    });
    if (blocked) return fail(state, blocked);
  }
  row.status = accept ? "accepted" : "declined";
  row.responded_at = new Date().toISOString();
  if (accept) {
    const patch = replacementPartnerPatch(String(row.partner_id));
    for (const job of state.jobs) {
      if (
        job.driver_id === row.lead_id &&
        job.needs_second_person === true &&
        job.partner_lost_at &&
        ["assigned", "en_route_pickup"].includes(String(job.status))
      ) {
        job.partner_driver_id = patch.partner_driver_id;
        job.partner_lost_at = patch.partner_lost_at;
      }
    }
  }
  return ok(state, { status: row.status, name: state.users.find((user) => user.id === row.partner_id)?.display_name ?? "Partner" });
}

function todayPartnership(state: DemoState, userId: string) {
  const today = chicagoDate();
  return state.driver_partnerships.find(
    (row) => row.shift_date === today && row.status === "accepted" && (row.lead_id === userId || row.partner_id === userId),
  );
}

function endPartnership(state: DemoState, userId: string) {
  const row = todayPartnership(state, userId);
  if (!row) return ok(state, { status: "none" });
  const busy = state.jobs.some(
    (job) =>
      job.driver_id === row.lead_id &&
      job.needs_second_person === true &&
      job.partner_driver_id === row.partner_id &&
      ["at_pickup", "en_route_dropoff", "at_dropoff", "delivered"].includes(String(job.status)),
  );
  if (busy) return fail(state, "Finish your current 2-person job first.");
  for (const job of state.jobs) {
    if (job.driver_id === row.lead_id && job.needs_second_person === true && ["assigned", "en_route_pickup"].includes(String(job.status))) {
      job.partner_lost_at = new Date().toISOString();
      job.partner_driver_id = null;
    }
  }
  row.status = "ended";
  row.ended_at = new Date().toISOString();
  row.ended_by = userId;
  return ok(state, { status: "ended" });
}

function simulateBackout(state: DemoState, leadId: string) {
  const today = chicagoDate();
  let partnership = activePartnership(state, leadId);
  if (!partnership) {
    state.driver_partnerships.push({
      id: id(),
      lead_id: leadId,
      partner_id: "c0000000-0000-4000-8000-000000000014",
      shift_date: today,
      status: "accepted",
      invited_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      ended_at: null,
      ended_by: null,
    });
    partnership = activePartnership(state, leadId);
  }
  let job = state.jobs.find(
    (item) => item.driver_id === leadId && item.needs_second_person === true && ["assigned", "en_route_pickup"].includes(String(item.status)),
  );
  if (!job) {
    job = {
      id: id(),
      customer_id: "b0000000-0000-4000-8000-000000000002",
      driver_id: leadId,
      partner_driver_id: partnership?.partner_id ?? null,
      status: "assigned",
      needs_second_person: true,
      item_description: "Fridge",
      pickup_address: "21 E Government St, Pensacola, FL",
      dropoff_address: "5100 N 9th Ave, Pensacola, FL",
      pickup_lat: 30.4088,
      pickup_lng: -87.2166,
      dropoff_lat: 30.4758,
      dropoff_lng: -87.208,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.jobs.push(job);
  }
  if (partnership) {
    partnership.status = "ended";
    partnership.ended_at = new Date().toISOString();
  }
  job.partner_lost_at = new Date().toISOString();
  job.partner_driver_id = null;
  const deadline = new Date(Date.now() + 10 * 60 * 1000);
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(deadline);
  return ok(state, { status: "backing_out", deadline: clock, message: `Dee can't make it. Pick another partner by ${clock} to keep this job.` });
}

function releasePartnerWindow(state: DemoState, leadId: string) {
  const job = state.jobs.find((item) => item.driver_id === leadId && item.partner_lost_at && ["assigned", "en_route_pickup"].includes(String(item.status)));
  if (!job) return ok(state, { status: "none", message: "No job to release" });
  job.status = "open";
  job.driver_id = null;
  job.partner_driver_id = null;
  job.accepted_at = null;
  job.partner_lost_at = null;
  job.updated_at = new Date().toISOString();
  return ok(state, { status: "released", message: "Job released, no penalty" });
}

export function freshDemoState(): DemoState {
  return createDemoState();
}
