import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { postalCode, routeMiles } from "../_shared/distance.ts";
import { HttpError, json, readJson, serveJson } from "../_shared/http.ts";
import { loadPickupRates } from "../_shared/rates.ts";
import { coverageDecision, normalizeZip } from "../_shared/pricing.ts";
import { requireUser } from "../_shared/supabase.ts";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin } = await requireUser(req);
  const body = await readJson(req);
  const pickupLat = Number(body.pickup_lat);
  const pickupLng = Number(body.pickup_lng);
  const dropoffLat = Number(body.dropoff_lat);
  const dropoffLng = Number(body.dropoff_lng);
  if (![pickupLat, pickupLng, dropoffLat, dropoffLng].every((value) => Number.isFinite(value))) {
    throw new HttpError(400, "Pickup and drop-off coordinates are required");
  }

  const pickupZip = normalizeZip(await postalCode(pickupLat, pickupLng));
  const dropoffZip = normalizeZip(await postalCode(dropoffLat, dropoffLng));
  const { data: zoneRows } = await admin.from("service_zone_zips").select("zip");
  const zoneZips = (zoneRows ?? []).map((row: { zip: string }) => String(row.zip));
  const rates = await loadPickupRates(admin);
  const distance = await routeMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const decision = coverageDecision({
    pickupZip,
    dropoffZip,
    roadMiles: distance.miles,
    zoneZips,
    maxMiles: rates.maxLoadedMiles,
  });
  if (!decision.ok) throw new HttpError(422, decision.message);

  return json({
    ok: true,
    roadMiles: distance.miles,
    pickupZip: decision.pickupZip,
    dropoffZip: decision.dropoffZip,
    pickupInZone: decision.pickupInZone,
    dropoffInZone: decision.dropoffInZone,
    distanceSource: distance.source,
    billableMiles: decision.billableMiles,
  });
});
