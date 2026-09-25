import { ratesFromCard, type Rates } from "../../../packages/shared/src/pricing/serverRules.ts";

type Query = { from: (table: string) => any };

/** Active pickup card plus every size tier. Same loader for quote and publish. */
export async function loadPickupRates(admin: Query): Promise<Rates> {
  const { data } = await admin.from("rate_cards").select("*").eq("active", true).eq("vehicle_type", "pickup").limit(1).maybeSingle();
  if (!data) return ratesFromCard(null, null);
  const { data: tiers } = await admin.from("size_tier_rates").select("*").eq("rate_card_id", data.id);
  return ratesFromCard(data, tiers ?? []);
}
