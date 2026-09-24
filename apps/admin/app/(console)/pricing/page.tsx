import { SIZE_LABEL, VEHICLE_LABEL } from "@heft/shared";
import { updatePricingRule } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function PricingPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: rules } = await gate.supabase
    .from("pricing_rules")
    .select("*")
    .order("vehicle_type")
    .order("size_category");

  return (
    <main>
      <h1 className="text-3xl font-semibold">Pricing rules</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
        Seeded Pensacola defaults. These rows are configuration, not revenue. Edits apply to the next quote. Amounts
        are dollars; the database stores cents.
      </p>
      <ul className="mt-6 space-y-4">
        {(rules ?? []).map((rule) => (
          <li key={rule.id} className="border border-line bg-white p-5">
            <form action={updatePricingRule} className="grid gap-3 md:grid-cols-6 md:items-end">
              <input type="hidden" name="id" value={rule.id} />
              <p className="text-sm font-semibold md:col-span-2">
                {VEHICLE_LABEL[rule.vehicle_type] ?? rule.vehicle_type} · {SIZE_LABEL[rule.size_category] ?? rule.size_category}
                <span className="mt-1 block text-xs font-normal uppercase tracking-wider text-steel">{rule.market}</span>
              </p>
              <label className="text-xs font-semibold uppercase tracking-wider text-steel">
                Base
                <input name="base_dollars" defaultValue={dollars(rule.base_cents)} className="mt-1 w-full border border-line px-2 py-2 font-mono text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-steel">
                Per mile
                <input name="per_mile_dollars" defaultValue={dollars(rule.per_mile_cents)} className="mt-1 w-full border border-line px-2 py-2 font-mono text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-steel">
                Minimum
                <input name="min_dollars" defaultValue={dollars(rule.min_cents)} className="mt-1 w-full border border-line px-2 py-2 font-mono text-sm" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-steel">
                Size ×
                <input name="size_multiplier" defaultValue={Number(rule.size_multiplier).toFixed(2)} className="mt-1 w-full border border-line px-2 py-2 font-mono text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" name="active" defaultChecked={rule.active} />
                Active
              </label>
              <button className="h-10 bg-charcoal px-4 text-sm font-semibold text-paper md:col-span-2" type="submit">
                Save rule
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
