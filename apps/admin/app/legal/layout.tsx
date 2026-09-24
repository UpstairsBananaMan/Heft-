import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.28em] text-amber">HEFT</p>
      <p className="mt-4 border border-amber bg-white px-4 py-3 text-sm font-semibold">
        DRAFT. Not legal advice. Replace this before a public release.
      </p>
      <div className="mt-8">{children}</div>
      <p className="mt-10 flex gap-4 text-sm">
        <Link href="/legal/privacy" className="underline">
          Privacy Policy
        </Link>
        <Link href="/legal/terms" className="underline">
          Terms of Service
        </Link>
        <Link href="/login" className="underline">
          Admin sign in
        </Link>
      </p>
    </main>
  );
}
