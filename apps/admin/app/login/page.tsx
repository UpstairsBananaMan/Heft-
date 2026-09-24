"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("reason") === "not-admin" ? "This console is for admin accounts. Signup cannot create one." : "",
  );
  const [pending, setPending] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[420px_1fr]">
      <section className="flex flex-col justify-between bg-charcoal px-10 py-12 text-paper">
        <div>
          <p className="text-xs font-semibold tracking-[0.28em] text-amber">HEFT</p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Dispatch console</h1>
          <p className="mt-4 max-w-xs text-sm leading-6 text-paper/70">
            Jobs, driver approval, pricing, and disputes for Pensacola bulky freight.
          </p>
        </div>
        <p className="text-xs text-paper/50">Admin users are seeded. Customer and driver apps are separate.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-md border border-line bg-white p-8">
          <h2 className="text-lg font-semibold">Sign in</h2>
          {!configured ? (
            <p className="mt-4 text-sm leading-6 text-steel">
              Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/admin/.env.local. See the README.
            </p>
          ) : null}
          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-steel">
            Email
            <input
              className="mt-2 w-full border border-line px-3 py-3 text-sm text-charcoal outline-none focus:border-charcoal"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-steel">
            Password
            <input
              className="mt-2 w-full border border-line px-3 py-3 text-sm text-charcoal outline-none focus:border-charcoal"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="mt-4 text-sm text-charcoal">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || !configured}
            className="mt-6 h-12 w-full bg-amber text-sm font-semibold text-charcoal disabled:opacity-40"
          >
            {pending ? "Signing in" : "Enter console"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
