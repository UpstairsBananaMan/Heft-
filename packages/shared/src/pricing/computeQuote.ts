/**
 * Approved v1 quote. No imports, no I/O, no dates.
 * Edge functions load this same file.
 */

export type SizeTier = "small" | "medium" | "large" | "xl" | "truckload";
type VehicleType = "pickup" | "cargo_van" | "box_truck" | "flatbed";
export type DistanceSource = "maps" | "estimated";
export type LineCode = "base" | "miles" | "size" | "out_of_town" | "stairs" | "second_person" | "minimum";

export interface QuoteInput {
  sizeTier: SizeTier;
  roadMiles: number;
  distanceSource: DistanceSource;
  pickupInZone: boolean;
  dropoffInZone: boolean;
  pickupFlights: number;
  dropoffFlights: number;
  secondPerson: boolean;
  estJobHours: number;
  vehicleType: VehicleType;
}

export interface Rates {
  ratesVersion: string;
  baseCents: number;
  perMileCents: number;
  minFareCents: number;
  platformFeeBps: number;
  sizeTierAddonCents: Record<SizeTier, number>;
  stairsPerFlightCents: number;
  secondPersonPerHourCents: number;
  secondPersonMinCents: number;
  secondPersonStepCents: number;
  outOfTownPerMileCents: number;
  maxLoadedMiles: number;
  maxFlightsPerStop: number;
  estDeadheadMiles: number;
  estCityMinPerMile: number;
  estHighwayMinPerMile: number;
  estHighwayAfterMiles: number;
  estLoadMinutes: Record<SizeTier, number>;
  estAdminMinutes: number;
  estMinutesPerFlight: number;
}

export interface QuoteLine {
  code: LineCode;
  /** Same as code. Older views read `key`. */
  key: LineCode;
  label: string;
  amountCents: number;
  /** Same as amountCents. Older views read `cents`. */
  cents: number;
}

export interface QuoteOutput {
  lines: QuoteLine[];
  billableMiles: number;
  distanceSource: DistanceSource;
  outOfTown: boolean;
  bookable: boolean;
  totalCents: number;
  platformFeeCents: number;
  driverShareCents: number;
  helperShareCents: number;
  leadDriverKeepsCents: number;
  ratesVersion: string;
}

export class QuoteError extends Error {
  readonly code: "OUTSIDE_SERVICE_AREA" | "TOO_FAR" | "INVALID_INPUT";
  constructor(code: QuoteError["code"]) {
    super(code);
    this.name = "QuoteError";
    this.code = code;
  }
}

export const PICKUP_RATES: Rates = {
  ratesVersion: "2026-09-24",
  baseCents: 3900,
  perMileCents: 200,
  minFareCents: 5500,
  platformFeeBps: 1500,
  sizeTierAddonCents: { small: 0, medium: 2000, large: 4000, xl: 6500, truckload: 12000 },
  stairsPerFlightCents: 1500,
  secondPersonPerHourCents: 3000,
  secondPersonMinCents: 4500,
  secondPersonStepCents: 500,
  outOfTownPerMileCents: 175,
  maxLoadedMiles: 70,
  maxFlightsPerStop: 6,
  estDeadheadMiles: 15,
  estCityMinPerMile: 2,
  estHighwayMinPerMile: 1.2,
  estHighwayAfterMiles: 25,
  estLoadMinutes: { small: 10, medium: 20, large: 30, xl: 45, truckload: 120 },
  estAdminMinutes: 10,
  estMinutesPerFlight: 5,
};

const SIZE_LABEL: Record<SizeTier, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xl: "Extra large",
  truckload: "Truckload",
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertMiles(roadMiles: number): void {
  if (!Number.isFinite(roadMiles) || roadMiles < 0) throw new QuoteError("INVALID_INPUT");
}

function assertFlights(flights: number, max: number): void {
  if (!Number.isInteger(flights) || flights < 0 || flights > max) throw new QuoteError("INVALID_INPUT");
}

export function billableMiles(roadMiles: number): number {
  assertMiles(roadMiles);
  return Math.ceil(round2(roadMiles));
}

function halfUp(cents: number, bps: number): number {
  return Math.floor((cents * bps + 5000) / 10000);
}

function line(code: LineCode, label: string, amountCents: number): QuoteLine {
  return { code, key: code, label, amountCents, cents: amountCents };
}

function driveMinutes(miles: number, rates: Rates): number {
  const city = rates.estCityMinPerMile * Math.min(miles, rates.estHighwayAfterMiles);
  const highway = rates.estHighwayMinPerMile * Math.max(0, miles - rates.estHighwayAfterMiles);
  return city + highway;
}

export function estimateJobMinutes(
  input: Pick<QuoteInput, "roadMiles" | "pickupInZone" | "dropoffInZone" | "sizeTier" | "pickupFlights" | "dropoffFlights">,
  rates: Rates = PICKUP_RATES,
): number {
  assertMiles(input.roadMiles);
  assertFlights(input.pickupFlights, rates.maxFlightsPerStop);
  assertFlights(input.dropoffFlights, rates.maxFlightsPerStop);
  const miles = billableMiles(input.roadMiles);
  const outOfTown = !(input.pickupInZone && input.dropoffInZone);
  const loaded = driveMinutes(miles, rates);
  const raw =
    rates.estDeadheadMiles * rates.estCityMinPerMile +
    loaded +
    (outOfTown ? loaded : 0) +
    rates.estLoadMinutes[input.sizeTier] +
    rates.estAdminMinutes +
    rates.estMinutesPerFlight * (input.pickupFlights + input.dropoffFlights);
  return Math.round(raw);
}

export function drivenMiles(billable: number, outOfTown: boolean, deadhead = PICKUP_RATES.estDeadheadMiles): number {
  return deadhead + billable + (outOfTown ? billable : 0);
}

/** Pricing code order. Price screens move out_of_town to sit after miles. */
export function customerLines(lines: QuoteLine[]): QuoteLine[] {
  const order: LineCode[] = ["base", "miles", "out_of_town", "size", "stairs", "second_person", "minimum"];
  return [...lines].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
}

export function computeQuote(input: QuoteInput, rates: Rates = PICKUP_RATES): QuoteOutput {
  if (!input.pickupInZone && !input.dropoffInZone) throw new QuoteError("OUTSIDE_SERVICE_AREA");
  assertMiles(input.roadMiles);
  assertFlights(input.pickupFlights, rates.maxFlightsPerStop);
  assertFlights(input.dropoffFlights, rates.maxFlightsPerStop);
  if (!Number.isFinite(input.estJobHours) || input.estJobHours < 0) throw new QuoteError("INVALID_INPUT");
  if (input.distanceSource !== "maps" && input.distanceSource !== "estimated") throw new QuoteError("INVALID_INPUT");

  const miles = billableMiles(input.roadMiles);
  if (miles > rates.maxLoadedMiles) throw new QuoteError("TOO_FAR");

  const outOfTown = !(input.pickupInZone && input.dropoffInZone);
  const second = input.secondPerson || input.sizeTier === "truckload";
  const lines: QuoteLine[] = [
    line("base", "Base", rates.baseCents),
    line("miles", `${miles} mi`, miles * rates.perMileCents),
  ];

  const sizeCents = rates.sizeTierAddonCents[input.sizeTier];
  if (sizeCents > 0) lines.push(line("size", SIZE_LABEL[input.sizeTier], sizeCents));
  if (outOfTown) lines.push(line("out_of_town", `Out of town (${miles} mi trip)`, miles * rates.outOfTownPerMileCents));

  const flights = input.pickupFlights + input.dropoffFlights;
  if (flights > 0) lines.push(line("stairs", `Stairs (${flights} flights)`, flights * rates.stairsPerFlightCents));

  let secondCents = 0;
  if (second) {
    const minutes = Math.round(input.estJobHours * 60);
    const a = rates.secondPersonPerHourCents * minutes;
    const b = 60 * rates.secondPersonStepCents;
    const steps = Math.floor((a + b - 1) / b);
    secondCents = Math.max(rates.secondPersonMinCents, steps * rates.secondPersonStepCents);
    lines.push(line("second_person", "Second person", secondCents));
  }

  const subtotal = lines.reduce((sum, item) => sum + item.amountCents, 0);
  if (subtotal < rates.minFareCents) {
    lines.push(line("minimum", "Minimum fare adjustment", rates.minFareCents - subtotal));
  }

  const totalCents = lines.reduce((sum, item) => sum + item.amountCents, 0);
  const platformFeeCents = halfUp(totalCents, rates.platformFeeBps);
  const driverShareCents = totalCents - platformFeeCents;
  const helperShareCents = secondCents === 0 ? 0 : secondCents - halfUp(secondCents, rates.platformFeeBps);
  const leadDriverKeepsCents = driverShareCents - helperShareCents;

  return {
    lines,
    billableMiles: miles,
    distanceSource: input.distanceSource,
    outOfTown,
    bookable: input.distanceSource === "maps",
    totalCents,
    platformFeeCents,
    driverShareCents,
    helperShareCents,
    leadDriverKeepsCents,
    ratesVersion: rates.ratesVersion,
  };
}
