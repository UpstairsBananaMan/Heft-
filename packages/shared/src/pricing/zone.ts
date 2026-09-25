/**
 * Local zone from Pricing §4a, plus Molino 32577.
 * Beulah is 32526 (Pensacola) and 32533 (Cantonment). Both are in this list.
 */
export const SERVICE_ZONE_ZIPS = [
  "32501",
  "32502",
  "32503",
  "32504",
  "32505",
  "32506",
  "32507",
  "32508",
  "32509",
  "32511",
  "32512",
  "32513",
  "32514",
  "32516",
  "32520",
  "32521",
  "32522",
  "32523",
  "32524",
  "32526",
  "32530",
  "32533",
  "32534",
  "32559",
  "32560",
  "32561",
  "32562",
  "32563",
  "32570",
  "32571",
  "32572",
  "32577",
  "32583",
  "32591",
] as const;

const ZONE = new Set<string>(SERVICE_ZONE_ZIPS);

export function normalizeZip(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const match = zip.match(/\d{5}/);
  return match ? match[0] : null;
}

export function zipInZone(zip: string | null | undefined): boolean {
  const normalized = normalizeZip(zip);
  return normalized != null && ZONE.has(normalized);
}
