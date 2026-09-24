# Heft

## What Heft is

Heft is a phone app and a website for bulky deliveries in Pensacola: furniture, lumber, and other large loads.

- A **customer** asks for a pickup and a drop-off, sees a price, and publishes the job.
- A **driver** goes online, accepts a job, walks it to the drop-off, and takes a photo.
- An **admin** (you) approves drivers, watches jobs, edits prices, and reads disputes on a website.

One account is one role. The phone app cannot make an admin. Money is shown in dollars and stored in cents. If Stripe and Google are not connected, the app still runs in **sandbox** mode: distance is estimated, and the payment hold is fake. No card is charged.

This repository does not submit the app to Apple or Google, and it does not contain live API keys.

## Click-through demo (no accounts)

Use this when you cannot install Docker or create Supabase, Expo, Stripe, or Maps accounts. Nothing is billed and no card is stored. Every sample row is labeled **Demo**.

```bash
git clone https://github.com/UpstairsBananaMan/Heft-.git
cd Heft-
npm install
npm run demo:admin
```

Open http://localhost:3000. The site signs you in as Demo Admin. An amber **Demo data** badge sits under the name.

In a second Terminal window:

```bash
npm run demo:mobile
```

Open the web address Expo prints, usually http://localhost:8081. Tap **Review as customer** or **Review as driver**. The amber **Demo** badge at the top switches roles, so one person can post a job and then accept it.

While both are running, a job published on the phone shows up on the website. The website keeps that sample data in `apps/admin/.demo-state.json` (not committed). If the website is closed, the phone keeps its own copy in the browser.

`npm run demo` is a different command. That one still needs local Supabase and loads a smaller SQL sample.

A static copy of the phone site, for a host that is not your laptop:

```bash
cd apps/mobile
EXPO_PUBLIC_DEMO_MODE=1 npx expo export --platform web --output-dir dist
```

Serve the `dist` folder. It still needs no accounts. If the admin site is not running, the phone keeps its sample data in that browser.

## What Dominick must buy/unlock

You can try Heft on your own computer with no accounts. A public release needs the accounts below. Create them yourself. Do not paste secret keys into GitHub.

1. **Apple Developer** — https://developer.apple.com/programs/enroll/  
   About $99 a year. Unlocks an iPhone build and the App Store. Heft’s iOS id is `com.heft.app`.

2. **Google Play Console** — https://play.google.com/console/signup  
   A one-time fee. Unlocks an Android build and Play. Heft’s Android id is `com.heft.app`.

3. **Stripe** — https://dashboard.stripe.com/register  
   Unlocks real card holds and driver payouts. Until the secret key is set on Supabase (not in this repo), publishes stay sandbox and payouts stay pending.

4. **Google Cloud Maps** — https://console.cloud.google.com/google/maps-apis/start  
   Unlocks driving miles and a map. Until that key is set, Heft uses straight-line miles and a list of Pensacola addresses.

5. **Expo** — https://expo.dev/signup  
   Unlocks cloud builds of the phone app (`eas build`). The project slug is `heft`.

6. **Supabase** — https://supabase.com/dashboard  
   Unlocks a cloud database so the phone and the website share real data when you are not on the same Wi‑Fi as your computer. The free project is enough to start.

Recommended order when you leave your laptop: Expo and Supabase first (a cloud try, and push once `eas init` sets a project id), then Stripe test mode and Google Maps, then Apple and Google for the stores. Job alerts stay off until `EXPO_PUBLIC_EAS_PROJECT_ID` is set. Payout setup stays a message until a Stripe test secret exists.

Draft Privacy Policy and Terms of Service are in the app under Account, and on the website at `/legal/privacy` and `/legal/terms`. They are marked **DRAFT** and are not legal advice. A lawyer should replace them before a store release.

## Local try

You do not edit code. You install four tools, start a database on your computer, then tap through the apps.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and leave it running.
2. Install [Node.js 20 or newer](https://nodejs.org/). In Terminal, `node -v` should start with `v20` or higher.
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
4. Install **Expo Go** on your phone. The phone and the computer must be on the same Wi‑Fi.

```bash
git clone https://github.com/UpstairsBananaMan/Heft-.git
cd Heft-
npm install
supabase start
supabase status
```

Copy the API URL and the anon key. Leave Google, Stripe, and the Expo project id blank.

See the marketplace loop without creating accounts by hand:

```bash
npm run demo
```

That loads sample data only: a customer, an approved online driver, and one open Pensacola job named “Demo sofa”. It does not add payouts or revenue. Sign in on the phone as `driver@heft.local` / `heft-driver-seed` and tap Accept, or as `customer@heft.local` / `heft-customer-seed` to open that job. Admin stays `admin@heft.local` / `heft-admin-seed`.

- Copy `apps/mobile/.env.example` to `apps/mobile/.env`
- Copy `apps/admin/.env.example` to `apps/admin/.env.local`

On a phone, replace `127.0.0.1` in the mobile URL with your computer’s Wi‑Fi address. Example: `http://192.168.1.20:54321`.

Two Terminal windows:

```bash
npm run admin
```

Open http://localhost:3000

```bash
npm run mobile
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone).

### What you tap

1. Sign up as a **customer**. Name, email, phone, and a password of at least 8 characters are required. **New** → two Pensacola stops (skip the one outside the service box) → **Get quote** → **Authorize hold and publish**. You should see a sandbox notice.
2. Sign out. Sign up as a **Driver**. Add a vehicle. Capacity, bed length, and a radius from 1 to 100 miles are required. You will see **Waiting on approval**. You cannot go online yet.
3. On the computer, sign in at http://localhost:3000 as `admin@heft.local` / `heft-admin-seed`. Open **Drivers** and tap **Approve**.
4. In Expo Go, sign in as the driver. Tap **Go online**, then **Accept**.
5. Walk the status buttons. At drop-off, **Take photo** or **Choose from library**, then **Mark delivered**, then **Complete and record payout**.
6. Before a driver accepts, the customer can cancel from the job screen. After accept, the customer can cancel until the driver marks at pickup. The driver can cancel only while assigned or on the way to pickup. Either person can open a dispute from the job screen after accept, and for 72 hours after the job is paid.
7. **Earnings** shows a pending payout. Admin **Dashboard** and **Revenue** show the platform fee. **Revenue → Download CSV** saves the paid jobs. **Disputes** has buttons to investigate, resolve, or close. Closing does not refund a card.

If `supabase start` says Docker is not running, open Docker Desktop and try again. To wipe local data and recreate the admin user: `supabase db reset`.

## Cloud try (Supabase)

Use this when the phone should work away from your computer.

1. Create a project at https://supabase.com/dashboard
2. Copy the project ref from the dashboard URL (`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`).
3. On your computer, from the Heft folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

`supabase/project.example` is the same checklist. Do not commit the real ref if you want it off GitHub.

4. In the Supabase dashboard, open **Project Settings → API**. Copy the project URL and the **anon** key into the host’s environment. Templates with empty secrets:

- `apps/mobile/.env.production.example`
- `apps/admin/.env.production.example`

5. Create a normal user in the dashboard (or sign up in the app), then run `supabase/scripts/promote_admin.sql` in the SQL editor after changing the email. Signup cannot grant admin. The database turns an admin role sent at signup into a customer.

6. **Authentication → URL configuration**: allow `heft://auth/callback` and your admin website address. Email confirmation links open the Heft app.

7. Deploy the edge functions (`quote`, `publish-job`, `accept-job`, `update-job-status`, `complete-job`, `stripe-webhook`, `notify`). Leave Stripe and Google secrets unset to stay in sandbox. Set them later with `supabase secrets set` on your machine, not in a file in this repo.

8. Put the admin site on a host that can run Next.js (the `apps/admin` folder) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Open `/legal/privacy` to confirm the draft pages are public.

## Store release checklist

Do these in order. This pass does not upload a build.

1. Lawyer replaces the draft Privacy Policy and Terms.
2. Apple Developer and Google Play accounts are active. Bundle ids stay `com.heft.app`.
3. Expo account owns the `heft` project. From `apps/mobile`, after `npm install -g eas-cli` and `eas login`:
   - `eas build --profile preview` for a test install
   - `eas build --profile production` when you are ready to ship
4. Set Supabase, and later Stripe and Maps, as **EAS environment variables** for the production profile. Do not put them in `eas.json` or git. Profiles in `apps/mobile/eas.json`: `development`, `preview`, `production`.
5. Icons and splash in `apps/mobile/assets` are placeholders (charcoal, the word HEFT). Replace them before the store listing.
6. Hosted Supabase is linked, migrations are pushed, and one admin exists.
7. Sandbox path still works with the keys missing. Turn on Stripe test mode before live keys.
8. Play submit profile is set to the **internal** track. Do not run `eas submit` until you mean to.

## For a developer

```bash
npm test
npm run typecheck
npm run admin
npm run mobile
```

Quote math lives in `packages/shared`. Sandbox adapters live in `supabase/functions`. GitHub Actions runs typecheck and tests on pull requests.

Out of scope: multi-city markets, chat, scheduled windows, dual-role accounts, live Stripe keys in the repo, and store submission.

Brand: charcoal `#1A1D21`, off-white `#F4F1EA`, safety amber `#E8A317`, steel `#5C6670`.
