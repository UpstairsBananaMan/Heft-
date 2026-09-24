# Heft

Pensacola-first marketplace for furniture, lumber, and other bulky loads. One Supabase project backs three roles:

- **Customer** and **driver** share `apps/mobile` (Expo). Signup chooses the role. One account, one role.
- **Admin** uses `apps/admin` (Next.js). Admin is seeded, not offered at signup.

Money is integer cents. The quote formula lives in `packages/shared` and is copied in `supabase/functions/_shared/pricing.ts`.

```
amount = max(min_cents, base_cents + per_mile_cents * miles) * size_multiplier * vehicle_mult
```

`vehicle_mult` is 1. Vehicle class is already priced by the matching `pricing_rules` row (base, per mile, minimum). Platform fee is 15% of the final amount. The driver payout is the remainder.

Jobs outside roughly 30.1–30.7 N, 87.6–86.9 W are rejected with “Not in service area yet”.

## Repo

```
apps/mobile     Expo SDK 53, Expo Router, NativeWind, TanStack Query, Zustand
apps/admin      Next.js App Router, Tailwind
packages/shared Job, User, DriverProfile, PricingRule, quote math
supabase        migrations, RLS, seed, edge functions
```

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (required by `supabase start`)
- Expo Go or a simulator for the phone app

## Setup

```bash
npm install
supabase start
supabase status
```

Copy the API URL and anon key into both env files:

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example apps/admin/.env.local
```

Set `EXPO_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` and the matching anon key. On a physical phone, use your machine’s LAN address instead of `127.0.0.1`. The Android emulator uses `http://10.0.2.2:54321`.

`supabase start` applies `supabase/migrations` and `supabase/seed.sql`.

### Seed (local only)

Seed is configuration, not traffic. It inserts Pensacola `pricing_rules` and one admin. It does not insert jobs, payouts, or revenue.

| | |
| --- | --- |
| Email | `admin@heft.local` |
| Password | `heft-admin-seed` |
| Role | `admin` |

Sign in with that account on the admin console. Do not treat the password as a production secret.

Hosted projects cannot use the `auth.users` insert. Create the user in the dashboard, then run `supabase/scripts/promote_admin.sql` in the SQL editor after changing the email.

If local seed fails because a GoTrue column name differs, create any user and promote them with that script.

Reset the local database (re-runs migrations and seed):

```bash
supabase db reset
```

## Run

```bash
npm run admin     # http://localhost:3000
npm run mobile    # Expo dev server
npm test          # quote, distance, and status rules
```

## Walkthrough

1. Sign up in the app as a customer. New request → pick two Pensacola presets → Get quote → Authorize hold and publish.
2. Sign up as a driver (second account). Submit the vehicle with the default Pensacola center and a 25 mile radius.
3. In admin, open Drivers and approve that vehicle.
4. In the driver app, go online. The open job appears on the map and in the list. Accept it.
5. Walk the statuses: en route to pickup, at pickup, en route to drop-off, at drop-off. Upload a proof-of-delivery photo, mark delivered, then complete. Earnings shows a **pending** payout when Stripe Connect is not configured.
6. Admin dashboard, jobs, and revenue read those rows. Zeros stay zeros until a job exists.

The preset labeled “Outside service box” is there to check the service-area error.

## Optional keys

Leave these blank. Quote, publish, accept, status changes, and complete still run.

| Variable | Where | If missing |
| --- | --- | --- |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `apps/mobile/.env` | Address presets. Map still opens Apple/Google Maps directions by lat/lng. |
| `GOOGLE_MAPS_API_KEY` | `supabase secrets set` for functions | Distance is haversine miles, returned as `distance_source: "haversine"`. |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | mobile | Unused by the sandbox path. The server places the hold. |
| `STRIPE_SECRET_KEY` | edge functions | PaymentIntent id is `pi_sandbox_<uuid>`. No charge. |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | The function acknowledges and does not mutate jobs. `complete-job` records the payout itself. |

With a Stripe **test** secret, publish confirms a manual-capture hold using the test PaymentMethod `pm_card_visa`. If the driver profile has `stripe_connect_account_id`, complete creates a transfer. Otherwise the payout row stays `pending`.

Push uses Expo’s push service and `device_tokens`. A simulator often cannot issue a token; the rest of the app still runs. Enable alerts from Account on a device.

## Edge functions

`quote`, `publish-job`, `accept-job`, `update-job-status`, `complete-job`, `stripe-webhook`, `notify`.

`stripe-webhook` does not verify a Supabase JWT. The others require the signed-in user. `accept_job` is a Postgres function granted only to the service role so the first accept is a single locked update.

## Out of scope

Multi-city markets, chat, scheduled windows, helpers, dual-role accounts, live Stripe keys, and store submission.

## Brand

Charcoal `#1A1D21`, off-white `#F4F1EA`, safety amber `#E8A317`, steel `#5C6670`.
