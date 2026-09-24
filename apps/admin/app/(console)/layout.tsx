import Link from "next/link";
import { APP_NAME, APP_WORDMARK } from "@heft/shared";
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
        <p className="text-sm font-semibold tracking-[0.2em]">{APP_WORDMARK}</p>
        <h1 className="mt-4 text-3xl font-semibold">Admin is not configured</h1>
        <p className="mt-4 text-sm leading-6 text-steel">
          Copy apps/admin/.env.example to apps/admin/.env.local and fill in the local Supabase URL and anon key.
        </p>
      </main>
    );
  }

  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col bg-charcoal text-paper lg:sticky lg:top-0 lg:h-screen">
        <div className="px-5 py-6">
          <p className="text-lg font-extrabold tracking-tight">
            {APP_WORDMARK}
            <span className="text-amber">.</span>
          </p>
          <p className="mt-1 text-sm text-paper/70">Ops console · Pensacola</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl px-3 py-3 text-sm hover:bg-ink-800">
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-5 pb-2 text-xs text-paper/70">
          <Link href="/legal/privacy" className="block py-1 underline">
            Privacy (draft)
          </Link>
          <Link href="/legal/terms" className="block py-1 underline">
            Terms (draft)
          </Link>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm">{gate.displayName}</p>
          <form action={signOut}>
            <button type="submit" className="text-xs text-paper/70">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-end gap-4 px-6 py-4 text-sm text-steel">
          <span>
            {clock} CT
          </span>
          <span className="font-semibold text-charcoal">{APP_NAME}</span>
        </header>
        <div className="px-6 pb-10 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
