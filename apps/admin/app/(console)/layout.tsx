import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/lib/actions";

const LINKS = [
  ["/", "Dashboard"],
  ["/jobs", "Jobs"],
  ["/drivers", "Drivers"],
  ["/customers", "Customers"],
  ["/pricing", "Pricing"],
  ["/disputes", "Disputes"],
  ["/revenue", "Revenue"],
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const gate = await requireAdmin();
  if (!gate.configured) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <p className="text-xs font-semibold tracking-[0.28em] text-amber">HEFT</p>
        <h1 className="mt-4 text-3xl font-semibold">Admin is not configured</h1>
        <p className="mt-4 text-sm leading-6 text-steel">
          Copy apps/admin/.env.example to apps/admin/.env.local and fill in the local Supabase URL and anon key from
          supabase status.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-charcoal text-paper lg:min-h-screen">
        <div className="px-6 py-7">
          <p className="text-xs font-semibold tracking-[0.28em] text-amber">HEFT</p>
          <p className="mt-2 text-sm text-paper/70">{gate.displayName}</p>
          {process.env.NEXT_PUBLIC_DEMO_MODE === "1" ? (
            <p className="mt-3 inline-block bg-amber px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-charcoal">Demo data</p>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="px-6 py-3 text-sm hover:bg-white/5">
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-6 pb-2 text-xs text-paper/70">
          <Link href="/legal/privacy" className="block py-1 underline">
            Privacy (draft)
          </Link>
          <Link href="/legal/terms" className="block py-1 underline">
            Terms (draft)
          </Link>
        </div>
        <form action={signOut} className="p-6">
          <button type="submit" className="text-xs font-semibold uppercase tracking-wider text-paper/70">
            Sign out
          </button>
        </form>
      </aside>
      <div className="min-w-0 px-6 py-8 lg:px-10">{children}</div>
    </div>
  );
}
