import assert from "node:assert/strict";
import test from "node:test";
import { applyDemo } from "./apply";
import { createDemoState, DEMO_IDS } from "./seed";
import { DEMO_CORS_HEADERS, DEMO_SCHEMA_VERSION, demoErrorResult, prepareDemoState } from "./state";

test("demo state versions", async (t) => {
  await t.test("keeps a current file", () => {
    const seed = createDemoState();
    const prepared = prepareDemoState(seed);
    assert.equal(prepared.migrated, false);
    assert.equal(prepared.state.schema_version, DEMO_SCHEMA_VERSION);
    assert.equal(prepared.state.jobs.length, seed.jobs.length);
  });

  await t.test("fills tables missing from an older file", () => {
    const seed = createDemoState();
    const old = { jobs: seed.jobs, users: seed.users, driver_profiles: seed.driver_profiles };
    const prepared = prepareDemoState(old);
    assert.equal(prepared.migrated, true);
    assert.equal(prepared.state.schema_version, DEMO_SCHEMA_VERSION);
    assert.equal(prepared.state.jobs.length, seed.jobs.length);
    assert.ok(prepared.state.feed_posts.length >= 3);
    const applied = applyDemo(prepared.state, {
      kind: "query",
      table: "feed_posts",
      action: "select",
      filters: [{ op: "eq", column: "status", value: "approved" }],
      actor: { id: DEMO_IDS.customer, role: "customer" },
    });
    assert.equal(applied.result.error, null);
    assert.ok(Array.isArray(applied.result.data));
  });

  await t.test("resets a file that is not a demo state", () => {
    const prepared = prepareDemoState({ hello: "old" });
    assert.equal(prepared.migrated, true);
    assert.equal(prepared.state.schema_version, DEMO_SCHEMA_VERSION);
    assert.ok(prepared.state.jobs.length > 0);
  });

  await t.test("error payloads stay JSON and name the CORS header the route must send", () => {
    const body = demoErrorResult(new Error("old demo state"));
    assert.equal(body.data, null);
    assert.equal(body.error.message, "old demo state");
    assert.equal(DEMO_CORS_HEADERS["Access-Control-Allow-Origin"], "*");
    assert.match(DEMO_CORS_HEADERS["Access-Control-Allow-Methods"], /POST/);
  });
});
