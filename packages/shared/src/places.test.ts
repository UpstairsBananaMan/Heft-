import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inPensacola } from "./geo";
import { filterPlaces, PENSACOLA_PLACES } from "./places";
import { OUTSIDE_SERVICE_FIXTURE } from "./places.fixture";

describe("places", () => {
  it("keeps the reject fixture out of the app preset list", () => {
    assert.equal(
      PENSACOLA_PLACES.some((place) => place.label.includes("test reject")),
      false,
    );
    assert.equal(inPensacola(OUTSIDE_SERVICE_FIXTURE.lat, OUTSIDE_SERVICE_FIXTURE.lng), false);
    assert.equal(filterPlaces("outside", [OUTSIDE_SERVICE_FIXTURE, ...PENSACOLA_PLACES]).length, 0);
  });
});
