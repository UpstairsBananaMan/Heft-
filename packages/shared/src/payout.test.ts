import assert from "node:assert/strict";
import test from "node:test";
import { payoutAnnounce, payoutCaption, payoutPhase } from "./payout";

test("payout wording", async (t) => {
  await t.test("asks for setup on both screens until a bank is connected", () => {
    const phase = payoutPhase({ setupComplete: false, status: "pending" });
    assert.equal(phase, "needs_setup");
    assert.equal(payoutCaption(phase), "Set up payouts to get this");
  });

  await t.test("says the transfer is on its way only after setup", () => {
    const phase = payoutPhase({ setupComplete: true, status: "pending" });
    assert.equal(phase, "pending");
    assert.equal(payoutCaption(phase), "On its way to your account");
    assert.equal(payoutAnnounce("$48.00", phase), "$48.00 on its way to your account");
  });

  await t.test("says paid only when the payout has landed", () => {
    const phase = payoutPhase({ setupComplete: false, status: "paid" });
    assert.equal(phase, "paid");
    assert.equal(payoutCaption(phase), "Paid");
    assert.equal(payoutAnnounce("$48.00", phase), "$48.00 paid");
  });
});
