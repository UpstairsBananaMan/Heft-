import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PICKUP_RATES,
  QuoteError,
  billableMiles,
  computeQuote,
  estimateJobMinutes,
  type DistanceSource,
  type QuoteInput,
  type SizeTier,
} from "./pricing/computeQuote";
import { zipInZone } from "./pricing/zone";

type Row = {
  caseName: string;
  input: QuoteInput;
  minutes: number;
  lines: string;
  totalCents: number;
  platformFeeCents: number;
  driverShareCents: number;
  helperShareCents: number;
  leadDriverKeepsCents: number;
  bookable: boolean;
};

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\n/);
  const rows: string[][] = [];
  for (const line of lines.slice(1)) {
    const cells: string[] = [];
    let buf = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === "," && !quoted) {
        cells.push(buf);
        buf = "";
        continue;
      }
      buf += char;
    }
    cells.push(buf.replace(/\r$/, ""));
    rows.push(cells);
  }
  return rows.map((cells) => {
    const minutes = Number(cells[9]);
    const input: QuoteInput = {
      sizeTier: cells[1] as SizeTier,
      roadMiles: Number(cells[2]),
      distanceSource: cells[3] as DistanceSource,
      pickupInZone: cells[4] === "true",
      dropoffInZone: cells[5] === "true",
      pickupFlights: Number(cells[6]),
      dropoffFlights: Number(cells[7]),
      secondPerson: cells[8] === "true",
      estJobHours: minutes / 60,
      vehicleType: cells[10] as QuoteInput["vehicleType"],
    };
    return {
      caseName: cells[0],
      input,
      minutes,
      lines: cells[11],
      totalCents: Number(cells[12]),
      platformFeeCents: Number(cells[13]),
      driverShareCents: Number(cells[14]),
      helperShareCents: Number(cells[15]),
      leadDriverKeepsCents: Number(cells[16]),
      bookable: cells[17] === "true",
    };
  });
}

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "pricing/quote_test_cases.csv");
const cases = parseCsv(readFileSync(csvPath, "utf8"));

describe("quote test cases", () => {
  for (const row of cases) {
    it(row.caseName, () => {
      const quote = computeQuote(row.input, PICKUP_RATES);
      const packed = quote.lines.map((line) => `${line.code}:${line.amountCents}`).join("; ");
      assert.equal(packed, row.lines);
      assert.equal(quote.totalCents, row.totalCents);
      assert.equal(quote.platformFeeCents, row.platformFeeCents);
      assert.equal(quote.driverShareCents, row.driverShareCents);
      assert.equal(quote.helperShareCents, row.helperShareCents);
      assert.equal(quote.leadDriverKeepsCents, row.leadDriverKeepsCents);
      assert.equal(quote.bookable, row.bookable);
      assert.equal(quote.lines.reduce((sum, line) => sum + line.amountCents, 0), quote.totalCents);
      assert.equal(quote.platformFeeCents + quote.helperShareCents + quote.leadDriverKeepsCents, quote.totalCents);
      assert.equal(
        estimateJobMinutes(row.input, PICKUP_RATES),
        row.minutes,
      );
    });
  }

  it("covers every csv row", () => {
    assert.equal(cases.length, 18);
  });
});

describe("quote edges", () => {
  const base: QuoteInput = {
    sizeTier: "medium",
    roadMiles: 10,
    distanceSource: "maps",
    pickupInZone: true,
    dropoffInZone: true,
    pickupFlights: 0,
    dropoffFlights: 0,
    secondPerson: false,
    estJobHours: 80 / 60,
    vehicleType: "pickup",
  };

  it("refuses both ends outside the zone", () => {
    assert.throws(() => computeQuote({ ...base, pickupInZone: false, dropoffInZone: false }), (error: unknown) => {
      return error instanceof QuoteError && error.code === "OUTSIDE_SERVICE_AREA";
    });
  });

  it("gives the same out-of-town line either direction", () => {
    const left = computeQuote({ ...base, roadMiles: 40, dropoffInZone: false, estJobHours: 196 / 60 });
    const right = computeQuote({ ...base, roadMiles: 40, pickupInZone: false, dropoffInZone: true, estJobHours: 196 / 60 });
    assert.equal(
      left.lines.find((line) => line.code === "out_of_town")?.amountCents,
      right.lines.find((line) => line.code === "out_of_town")?.amountCents,
    );
  });

  it("refuses 71 miles", () => {
    assert.throws(() => computeQuote({ ...base, roadMiles: 71, dropoffInZone: false }), (error: unknown) => {
      return error instanceof QuoteError && error.code === "TOO_FAR";
    });
  });

  it("marks an estimated distance unbookable", () => {
    const quote = computeQuote({ ...base, roadMiles: 11.96, distanceSource: "estimated", estJobHours: 84 / 60 });
    assert.equal(quote.bookable, false);
    assert.equal(quote.totalCents, 8300);
  });

  it("forces a second person on truckload", () => {
    const quote = computeQuote({ ...base, sizeTier: "truckload", roadMiles: 5, secondPerson: false, estJobHours: 170 / 60 });
    assert.ok(quote.lines.some((line) => line.code === "second_person"));
  });

  it("rounds 10.1 miles up to 11", () => {
    assert.equal(billableMiles(10.1), 11);
  });

  it("keeps Beulah and Molino in the zone", () => {
    assert.equal(zipInZone("32526"), true);
    assert.equal(zipInZone("32533"), true);
    assert.equal(zipInZone("32577"), true);
    assert.equal(zipInZone("32566"), false);
  });

  it("keeps both sum identities on 1000 random inputs", () => {
    let seed = 20260924;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const tiers: SizeTier[] = ["small", "medium", "large", "xl", "truckload"];
    for (let i = 0; i < 1000; i += 1) {
      const tier = tiers[Math.floor(next() * tiers.length)]!;
      const miles = next() * 70;
      const pickupFlights = Math.floor(next() * 7);
      const dropoffFlights = Math.floor(next() * 7);
      const pickupInZone = next() > 0.2;
      const dropoffInZone = pickupInZone ? next() > 0.3 : true;
      const input: QuoteInput = {
        sizeTier: tier,
        roadMiles: miles,
        distanceSource: next() > 0.1 ? "maps" : "estimated",
        pickupInZone,
        dropoffInZone,
        pickupFlights,
        dropoffFlights,
        secondPerson: next() > 0.5,
        estJobHours: (20 + next() * 200) / 60,
        vehicleType: "pickup",
      };
      const quote = computeQuote(input);
      assert.equal(quote.lines.reduce((sum, line) => sum + line.amountCents, 0), quote.totalCents);
      assert.equal(quote.platformFeeCents + quote.helperShareCents + quote.leadDriverKeepsCents, quote.totalCents);
    }
  });
});
