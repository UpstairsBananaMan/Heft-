import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, json, serveJson } from "../_shared/http.ts";
import { connectOnboardingLink, stripeConfigured } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/supabase.ts";

const APP_RETURN = "heft://stripe/connect";

serveJson(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const { admin, user } = await requireUser(req);
  const { data: actor } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "driver") throw new HttpError(403, "Only a driver can set up payouts");
  const { data: driver } = await admin
    .from("driver_profiles")
    .select("user_id, stripe_connect_account_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) throw new HttpError(409, "Add a vehicle before payout setup");

  if (!stripeConfigured()) {
    return json({
      sandbox: true,
      url: null,
      message: "Payout setup waits for a Stripe test secret. No Connect account was created. The rest of Heft still runs.",
    });
  }

  const httpsReturn = Deno.env.get("CONNECT_RETURN_URL");
  const returnUrl = httpsReturn && httpsReturn.startsWith("https://") ? httpsReturn : APP_RETURN;
  const link = await connectOnboardingLink({
    accountId: driver.stripe_connect_account_id,
    userId: user.id,
    returnUrl,
    refreshUrl: returnUrl,
  });
  if (!link) {
    return json({ sandbox: true, url: null, message: "Stripe is not configured." });
  }
  if (link.accountId !== driver.stripe_connect_account_id) {
    await admin.from("driver_profiles").update({ stripe_connect_account_id: link.accountId }).eq("user_id", user.id);
  }
  return json({
    sandbox: false,
    url: link.url,
    message: "Stripe test mode opened. Finish there, then return to Heft.",
  });
});
