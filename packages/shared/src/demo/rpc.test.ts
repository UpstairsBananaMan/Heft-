import assert from "node:assert/strict";
import test from "node:test";
import { applyDemo } from "./apply";
import { createDemoQuery } from "./query";
import { createDemoState, DEMO_IDS } from "./seed";

test("assigned driver card rpc", async (t) => {
  await t.test("reads the card through rpc p_job_id, not an edge function", async () => {
    const state = createDemoState();
    const query = createDemoQuery((request) => {
      assert.equal(request.kind, "invoke");
      if (request.kind === "invoke") {
        assert.equal(request.name, "assigned_driver_card");
        assert.equal(request.body?.job_id, DEMO_IDS.activeJob);
      }
      return applyDemo(state, { ...request, actor: { id: DEMO_IDS.customer, role: "customer" } }).result;
    });
    const result = await query.rpc("assigned_driver_card", { p_job_id: DEMO_IDS.activeJob });
    assert.equal(result.error, null);
    const card = result.data as { display_name: string; plate: string };
    assert.equal(card.display_name, "Marcus T.");
    assert.equal(card.plate, "QXT 482");
  });
});
