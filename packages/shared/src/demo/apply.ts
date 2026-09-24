import { haversineMiles, inPensacola, roundMiles } from "../geo";
import { quoteLines, splitCents } from "../pricing";
import { SIZE_LABEL, VEHICLE_LABEL } from "../status";
import { canCancel, nextDriverStatus } from "../status";
import type { JobStatus, Role, VehicleType } from "../types";
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

function visible(table: TableName, rows: DemoRow[], actor: DemoRequest["actor"]): DemoRow[] {
  if (!actor || actor.role === "admin") return rows;
  if (table === "jobs" && actor.role === "customer") return rows.filter((row) => row.customer_id === actor.id);
  if (table === "jobs" && actor.role === "driver") {
    return rows.filter((row) => row.status === "open" || row.driver_id === actor.id);
  }
  if (table === "payouts" && actor.role === "driver") return rows.filter((row) => row.driver_id === actor.id);
  if (table === "users") return rows.filter((row) => row.id === actor.id);
  return rows;
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
  if (request.kind === "invoke") return applyInvoke(state, request);
  if (!isTable(request.table)) return fail(state, `Unknown table ${request.table}`);
  const table = request.table;
  const filters = request.filters ?? [];
  const actor = request.actor;

  if (request.action === "select") {
    let rows = visible(table, rowsOf(state, table), actor).filter((row) => matches(row, filters));
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
    const created = incoming.map((row) => decorateInsert(table, row));
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
      return { ...row, ...patch, updated_at: new Date().toISOString() };
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
      approved_documents: Boolean(licenseOk && insuranceOk && profile?.status === "approved"),
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
  if (!job && request.name !== "connect-onboarding") return fail(state, "Job not found");
  if (!job) return fail(state, "Job not found");

  if (request.name === "quote") {
    if (job.customer_id !== actor.id) return fail(state, "Only the customer can quote this job");
    if (job.status !== "draft" && job.status !== "priced") return fail(state, "Only a draft or priced job can be quoted");
    const pickupLat = Number(job.pickup_lat);
    const pickupLng = Number(job.pickup_lng);
    const dropLat = Number(job.dropoff_lat);
    const dropLng = Number(job.dropoff_lng);
    if (!inPensacola(pickupLat, pickupLng) || !inPensacola(dropLat, dropLng)) return fail(state, "Not in service area yet");
    const miles = roundMiles(haversineMiles(pickupLat, pickupLng, dropLat, dropLng));
    const rule = state.pricing_rules.find(
      (item) => item.market === "pensacola" && item.vehicle_type === job.vehicle_required && item.size_category === job.size_category && item.active === true,
    );
    if (!rule) return fail(state, "No active pricing rule for this vehicle and size");
    const stairs = Number(job.stairs_pickup_flights ?? 0) + Number(job.stairs_dropoff_flights ?? 0) > 0;
    const breakdown = quoteLines(
      {
        vehicle_type: job.vehicle_required as VehicleType,
        base_cents: Number(rule.base_cents),
        per_mile_cents: Number(rule.per_mile_cents),
        min_cents: Number(rule.min_cents),
        size_multiplier: Number(rule.size_multiplier),
      },
      miles,
      {
        stairs,
        helper: job.needs_helper === true,
        vehicleLabel: VEHICLE_LABEL[String(job.vehicle_required)] ?? "Pickup truck",
        sizeLabel: SIZE_LABEL[String(job.size_category)] ?? "Medium",
      },
    );
    const estimate = breakdown.total_cents;
    const split = splitCents(estimate);
    Object.assign(job, {
      status: "priced",
      distance_miles: miles,
      estimate_cents: estimate,
      final_cents: estimate,
      platform_fee_cents: split.platform_fee_cents,
      driver_payout_cents: split.driver_payout_cents,
      quote_lines: breakdown.lines,
      updated_at: new Date().toISOString(),
    });
    state.job_events.push({
      id: id(),
      job_id: job.id,
      type: "priced",
      actor_id: actor.id,
      payload: { seed: "demo", distance_source: "haversine" },
      created_at: new Date().toISOString(),
    });
    return ok(state, {
      ...split,
      estimate_cents: estimate,
      total_cents: estimate,
      lines: breakdown.lines,
      distance_miles: miles,
      distance_source: "haversine",
      sandbox: true,
      status: "priced",
    });
  }

  if (request.name === "publish-job") {
    if (job.customer_id !== actor.id) return fail(state, "Only the customer can publish this job");
    if (job.status !== "priced") return fail(state, "Quote the job before publishing");
    job.status = "open";
    job.stripe_payment_intent_id = `pi_sandbox_${id()}`;
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
    if (job.status !== "open") return fail(state, "This job was already taken");
    job.status = "assigned";
    job.driver_id = actor.id;
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
    if (state.payouts.some((payout) => payout.job_id === job.id)) {
      job.status = "paid";
      return ok(state, { sandbox: true, job });
    }
    job.status = "paid";
    job.updated_at = new Date().toISOString();
    state.payouts.push({
      id: id(),
      job_id: job.id,
      driver_id: job.driver_id,
      amount_cents: job.driver_payout_cents ?? 0,
      status: "pending",
      created_at: job.updated_at,
    });
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

export function freshDemoState(): DemoState {
  return createDemoState();
}
