import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyDemo } from "./apply";
import { createDemoQuery } from "./query";
import { DEMO_IDS, createDemoState } from "./seed";

const customer = { id: DEMO_IDS.customer, role: "customer" as const };
const driver = { id: DEMO_IDS.driver, role: "driver" as const };
const admin = { id: DEMO_IDS.admin, role: "admin" as const };

function run(state = createDemoState("2026-09-24T12:00:00.000Z")) {
  return {
    state,
    apply(request: Parameters<typeof applyDemo>[1]) {
      const next = applyDemo(this.state, request);
      this.state = next.state;
      return next.result;
    },
  };
}

describe("demo backend", () => {
  it("hides other customers jobs and still lists an open job for the driver", () => {
    const demo = run();
    const mine = demo.apply({
      kind: "query",
      table: "jobs",
      action: "select",
      actor: customer,
    });
    assert.equal((mine.data as unknown[]).length, 6);
    const open = demo.apply({
      kind: "query",
      table: "jobs",
      action: "select",
      filters: [{ op: "eq", column: "status", value: "open" }],
      actor: driver,
    });
    assert.equal((open.data as { id: string }[])[0].id, DEMO_IDS.openJob);
  });

  it("quotes, publishes, accepts, and completes a new sofa job", () => {
    const demo = run();
    const inserted = demo.apply({
      kind: "query",
      table: "jobs",
      action: "insert",
      select: "id",
      single: "one",
      actor: customer,
      payload: {
        customer_id: DEMO_IDS.customer,
        status: "draft",
        pickup_address: "21 E Government St, Pensacola, FL",
        pickup_lat: 30.4088,
        pickup_lng: -87.2166,
        dropoff_address: "5100 N 9th Ave, Pensacola, FL",
        dropoff_lat: 30.4758,
        dropoff_lng: -87.208,
        item_description: "Sofa, 3 seat",
        size_category: "small",
        vehicle_required: "pickup",
      },
    });
    const jobId = (inserted.data as { id: string }).id;
    const quoted = demo.apply({ kind: "invoke", name: "quote", body: { job_id: jobId }, actor: customer });
    assert.equal(quoted.error, null);
    const quotedBody = quoted.data as { estimate_cents: number; lines: { cents: number }[]; total_cents: number };
    assert.ok(quotedBody.estimate_cents > 0);
    assert.equal(
      quotedBody.lines.reduce((sum, line) => sum + line.cents, 0),
      quotedBody.total_cents,
    );
    const published = demo.apply({ kind: "invoke", name: "publish-job", body: { job_id: jobId }, actor: customer });
    assert.equal((published.data as { sandbox: boolean }).sandbox, true);
    const accepted = demo.apply({ kind: "invoke", name: "accept-job", body: { job_id: jobId }, actor: driver });
    assert.equal(accepted.error, null);
    const again = demo.apply({ kind: "invoke", name: "accept-job", body: { job_id: jobId }, actor: driver });
    assert.match(again.error?.message ?? "", /already taken/);
    for (const status of ["en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"]) {
      const step = demo.apply({ kind: "invoke", name: "update-job-status", body: { job_id: jobId, status }, actor: driver });
      assert.equal(step.error, null, status);
    }
    const blocked = demo.apply({ kind: "invoke", name: "update-job-status", body: { job_id: jobId, status: "delivered" }, actor: driver });
    assert.match(blocked.error?.message ?? "", /proof/);
    demo.apply({
      kind: "query",
      table: "job_photos",
      action: "insert",
      actor: driver,
      payload: { job_id: jobId, storage_path: `${jobId}/pod.jpg`, kind: "pod" },
    });
    const delivered = demo.apply({ kind: "invoke", name: "update-job-status", body: { job_id: jobId, status: "delivered" }, actor: driver });
    assert.equal(delivered.error, null);
    const paid = demo.apply({ kind: "invoke", name: "complete-job", body: { job_id: jobId }, actor: driver });
    assert.equal((paid.data as { sandbox: boolean }).sandbox, true);
    const payouts = demo.apply({ kind: "query", table: "payouts", action: "select", actor: driver });
    assert.ok((payouts.data as unknown[]).length >= 3);
  });

  it("joins customer names and counts paid demo revenue", () => {
    const demo = run();
    const jobs = demo.apply({
      kind: "query",
      table: "jobs",
      action: "select",
      select: "id, item_description, customer:users!jobs_customer_id_fkey(display_name)",
      actor: admin,
    });
    const first = (jobs.data as { customer: { display_name: string }; item_description: string }[])[0];
    assert.equal(first.customer.display_name, "Dana R.");
    assert.doesNotMatch(first.item_description, /Demo/);
    const paid = demo.apply({
      kind: "query",
      table: "jobs",
      action: "select",
      filters: [{ op: "eq", column: "status", value: "paid" }],
      count: "exact",
      head: true,
      actor: admin,
    });
    assert.equal(paid.count, 2);
  });

  it("rejects a stop outside Pensacola", () => {
    const demo = run();
    const inserted = demo.apply({
      kind: "query",
      table: "jobs",
      action: "insert",
      single: "one",
      actor: customer,
      payload: {
        customer_id: DEMO_IDS.customer,
        status: "draft",
        pickup_address: "Mobile",
        pickup_lat: 30.6954,
        pickup_lng: -88.0399,
        dropoff_address: "Pensacola",
        dropoff_lat: 30.4088,
        dropoff_lng: -87.2166,
        item_description: "Too far",
        size_category: "small",
        vehicle_required: "pickup",
      },
    });
    const jobId = (inserted.data as { id: string }).id;
    const quoted = demo.apply({ kind: "invoke", name: "quote", body: { job_id: jobId }, actor: customer });
    assert.equal(quoted.error?.message, "Not in service area yet");
  });

  it("is awaitable from the query helper", async () => {
    let state = createDemoState("2026-09-24T12:00:00.000Z");
    const client = createDemoQuery((request) => {
      const next = applyDemo(state, { ...request, actor: admin });
      state = next.state;
      return next.result;
    });
    const result = await client.from("pricing_rules").select("*").eq("active", true);
    assert.equal((result.data as unknown[]).length, 16);
  });
});
