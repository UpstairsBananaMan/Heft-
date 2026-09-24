import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventLabel, loadFailureCopy } from "./copy";
import { haversineMiles, inPensacola, roundMiles, serviceAreaHint, vehicleCovers } from "./geo";
import { quoteCents, quoteLines, splitCents } from "./pricing";
import { canCancel, canOpenDispute, cancelHint, disputeBlockedReason, nextDriverStatus } from "./status";
import { isValidEmail, isValidPhone, publicSignupRole } from "./signup";
import { toCsv } from "./csv";
import type { VehicleType } from "./types";

function rule(
  vehicle_type: VehicleType,
  base_cents: number,
  per_mile_cents: number,
  min_cents: number,
  size_multiplier: number,
) {
  return { vehicle_type, base_cents, per_mile_cents, min_cents, size_multiplier };
}

describe("quote formula", () => {
  it("applies the pickup minimum at zero miles", () => {
    assert.equal(quoteCents(rule("pickup", 4500, 250, 5500, 1), 0), 5500);
  });

  it("uses base plus per-mile once that exceeds the minimum", () => {
    assert.equal(quoteCents(rule("pickup", 4500, 250, 5500, 1), 10), 7000);
  });

  it("multiplies by the size factor after the minimum check", () => {
    assert.equal(quoteCents(rule("pickup", 4500, 250, 5500, 1.15), 10), 8050);
    assert.equal(quoteCents(rule("pickup", 4500, 250, 5500, 1.6), 0), 8800);
  });

  it("keeps the box-truck minimum before the large multiplier", () => {
    assert.equal(quoteCents(rule("box_truck", 8500, 400, 11000, 1.35), 5), 14850);
  });

  it("itemizes stairs and helper without charging for placement", () => {
    const rule = { vehicle_type: "pickup" as const, base_cents: 4500, per_mile_cents: 250, min_cents: 5500, size_multiplier: 1.15 };
    const plain = quoteLines(rule, 10, { vehicleLabel: "Pickup truck", sizeLabel: "Medium" });
    const withAddons = quoteLines(rule, 10, { stairs: true, helper: true, vehicleLabel: "Pickup truck", sizeLabel: "Medium" });
    assert.equal(plain.lines.reduce((sum, line) => sum + line.cents, 0), plain.total_cents);
    assert.equal(withAddons.total_cents, plain.total_cents + 1500 + 2000);
    assert.equal(withAddons.lines.some((line) => line.key === "stairs"), true);
    assert.equal(plain.lines.some((line) => line.key === "helper"), false);
  });

  it("splits 15 percent to the platform in integer cents", () => {
    assert.deepEqual(splitCents(7000), {
      platform_fee_cents: 1050,
      driver_payout_cents: 5950,
    });
    assert.equal(splitCents(7000).platform_fee_cents + splitCents(7000).driver_payout_cents, 7000);
  });
});

describe("service area and distance", () => {
  it("names the Pensacola box when a point is outside", () => {
    assert.equal(inPensacola(30.4213, -87.2169), true);
    assert.match(serviceAreaHint(), /Pensacola area/);
    assert.doesNotMatch(serviceAreaHint(), /\d+\.\d+/);
  });

  it("accepts downtown Pensacola and rejects Mobile", () => {
    assert.equal(inPensacola(30.4213, -87.2169), true);
    assert.equal(inPensacola(30.6954, -88.0399), false);
    assert.equal(inPensacola(30.85, -87.2), false);
  });

  it("returns zero miles for the same point", () => {
    assert.equal(roundMiles(haversineMiles(30.42, -87.21, 30.42, -87.21)), 0);
  });

  it("ranks vehicles so a box truck can cover a pickup job", () => {
    assert.equal(vehicleCovers("box_truck", "pickup"), true);
    assert.equal(vehicleCovers("pickup", "flatbed"), false);
  });
});

describe("job transitions", () => {
  it("walks the driver forward and stops at delivered", () => {
    assert.equal(nextDriverStatus("assigned"), "en_route_pickup");
    assert.equal(nextDriverStatus("at_dropoff"), "delivered");
    assert.equal(nextDriverStatus("delivered"), null);
    assert.equal(nextDriverStatus("paid"), null);
  });

  it("lets a customer cancel before pickup and not after", () => {
    assert.equal(canCancel("open", "customer"), true);
    assert.equal(canCancel("assigned", "customer"), true);
    assert.equal(canCancel("at_pickup", "customer"), false);
    assert.equal(canCancel("open", "driver"), false);
    assert.equal(canCancel("assigned", "driver"), true);
    assert.equal(canCancel("en_route_dropoff", "driver"), false);
    assert.match(cancelHint("open", "customer") ?? "", /cancel for free/);
    assert.match(cancelHint("assigned", "customer") ?? "", /arrives at pickup/);
    assert.equal(cancelHint("at_pickup", "customer"), null);
  });

  it("explains when a dispute cannot be opened", () => {
    assert.match(disputeBlockedReason("open", null) ?? "", /report a problem/);
    assert.equal(disputeBlockedReason("assigned", null), null);
    assert.match(disputeBlockedReason("cancelled", null) ?? "", /cannot be disputed/);
  });

  it("closes the dispute window 72 hours after paid", () => {
    const paidAt = "2026-09-21T12:00:00.000Z";
    const within = new Date("2026-09-23T12:00:00.000Z").getTime();
    const after = new Date("2026-09-24T12:00:01.000Z").getTime();
    assert.equal(canOpenDispute("assigned", null), true);
    assert.equal(canOpenDispute("open", null), false);
    assert.equal(canOpenDispute("paid", paidAt, within), true);
    assert.equal(canOpenDispute("paid", paidAt, after), false);
    assert.match(disputeBlockedReason("paid", paidAt, after) ?? "", /72-hour/);
  });
});

describe("signup and csv", () => {
  it("never treats admin as a public signup role", () => {
    assert.equal(publicSignupRole("admin"), "customer");
    assert.equal(publicSignupRole("driver"), "driver");
    assert.equal(publicSignupRole("customer"), "customer");
    assert.equal(publicSignupRole(null), "customer");
  });

  it("checks email and phone shape without storing them", () => {
    assert.equal(isValidEmail("a@b.co"), true);
    assert.equal(isValidEmail("not-an-email"), false);
    assert.equal(isValidPhone("(850) 555-0100"), true);
    assert.equal(isValidPhone("555"), false);
  });

  it("uses plain offline copy and keeps other errors", () => {
    assert.equal(loadFailureCopy("Network request failed").title, "You look offline");
    assert.equal(loadFailureCopy("permission denied").title, "Could not load");
    assert.equal(eventLabel("status_restored"), "Status restored");
    assert.equal(eventLabel("en_route_pickup"), "En route to pickup");
  });

  it("quotes commas in csv cells", () => {
    const csv = toCsv(["item", "fee"], [["Sofa, blue", "1050"]]);
    assert.equal(csv, 'item,fee\n"Sofa, blue",1050\n');
  });
});
