export default function StripeConnectReturnPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.28em] text-amber">HEFT</p>
      <h1 className="mt-4 text-3xl font-semibold">Back from payout setup</h1>
      <p className="mt-4 text-sm leading-6 text-steel">
        If Stripe test mode sent you here, return to the Heft app. No card was stored on this page. Without a Stripe
        secret, Connect never creates an account.
      </p>
      <p className="mt-6">
        <a className="text-sm font-semibold underline" href="heft://stripe/connect">
          Open Heft
        </a>
      </p>
    </main>
  );
}