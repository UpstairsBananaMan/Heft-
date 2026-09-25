import { PICKUP_RATES, SERVICE_ZONE_ZIPS, formatUsd } from "@heft/shared";
import { requireAdmin } from "@/lib/auth";

export default async function PricingPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: zips } = await gate.supabase.from("service_zone_zips").select("zip").order("zip");
  const { data: card } = await gate.supabase.from("rate_cards").select("*").eq("active", true).limit(1).maybeSingle();
  const list = (zips ?? []).map((row) => row.zip as string);
  const shown = list.length > 0 ? list : [...SERVICE_ZONE_ZIPS];
  const rates = card ?? {
    rates_version: PICKUP_RATES.ratesVersion,
    base_cents: PICKUP_RATES.baseCents,
    per_mile_cents: PICKUP_RATES.perMileCents,
    min_fare_cents: PICKUP_RATES.minFareCents,
    platform_fee_bps: PICKUP_RATES.platformFeeBps,
    out_of_town_per_mile_cents: PICKUP_RATES.outOfTownPerMileCents,
    max_loaded_miles: PICKUP_RATES.maxLoadedMiles,
    max_flights_per_stop: PICKUP_RATES.maxFlightsPerStop,
  };

  return (
    <main>
      <h1 className="text-3xl font-semibold">Pricing</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
        Active pickup rates, version {rates.rates_version}. The ZIP list is read-only and changes by migration.
      </p>
      <dl className="mt-6 grid max-w-xl gap-3 border border-line bg-white p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wider text-steel">Base</dt><dd>{formatUsd(rates.base_cents)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-steel">Per mile</dt><dd>{formatUsd(rates.per_mile_cents)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-steel">Minimum</dt><dd>{formatUsd(rates.min_fare_cents)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-steel">Fee</dt><dd>{Number(rates.platform_fee_bps) / 100}%</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-steel">Out of town</dt><dd>{formatUsd(rates.out_of_town_per_mile_cents)} / mi</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-steel">Cap</dt><dd>{rates.max_loaded_miles} mi · {rates.max_flights_per_stop} flights</dd></div>
      </dl>
      <h2 className="mt-8 text-xl font-semibold">Local ZIPs</h2>
      <ul className="mt-3 flex max-w-3xl flex-wrap gap-2">
        {shown.map((zip) => (
          <li key={zip} className="rounded-full border border-line bg-white px-3 py-1 font-mono text-sm">{zip}</li>
        ))}
      </ul>
    </main>
  );
}
