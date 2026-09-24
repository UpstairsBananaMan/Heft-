import { formatUsd } from "@heft/shared";
import { requireAdmin } from "@/lib/auth";

export default async function RevenuePage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: jobs } = await gate.supabase
    .from("jobs")
    .select("id, item_description, final_cents, platform_fee_cents, driver_payout_cents, updated_at")
    .eq("status", "paid")
    .order("updated_at", { ascending: false });

  const rows = jobs ?? [];
  const fees = rows.reduce((sum, job) => sum + (job.platform_fee_cents ?? 0), 0);
  const gross = rows.reduce((sum, job) => sum + (job.final_cents ?? 0), 0);
  const payouts = rows.reduce((sum, job) => sum + (job.driver_payout_cents ?? 0), 0);

  return (
    <main>
      <h1 className="text-3xl font-semibold">Revenue</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
        {process.env.NEXT_PUBLIC_DEMO_MODE === "1"
          ? "Totals add the sample paid jobs labeled Demo. Completing a delivery in the phone demo adds another row. No card is charged."
          : "Totals are the sum of paid jobs in this project. Seed data does not include jobs, so a fresh database shows zero until a delivery is completed."}
      </p>
      <p className="mt-4">
        <a href="/revenue/export" className="text-sm font-semibold underline">
          Download CSV
        </a>
      </p>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <article className="border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-steel">Gross</p>
          <p className="mt-2 font-mono text-2xl">{formatUsd(gross)}</p>
        </article>
        <article className="border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-steel">Platform fees</p>
          <p className="mt-2 font-mono text-2xl">{formatUsd(fees)}</p>
        </article>
        <article className="border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-steel">Driver payouts</p>
          <p className="mt-2 font-mono text-2xl">{formatUsd(payouts)}</p>
        </article>
      </section>
      <div className="mt-6 overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-steel">
            <tr>
              <th className="px-4 py-3 font-semibold">Job</th>
              <th className="px-4 py-3 font-semibold">Gross</th>
              <th className="px-4 py-3 font-semibold">Fee</th>
              <th className="px-4 py-3 font-semibold">Payout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((job) => (
              <tr key={job.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{job.item_description}</td>
                <td className="px-4 py-3 font-mono">{formatUsd(job.final_cents)}</td>
                <td className="px-4 py-3 font-mono">{formatUsd(job.platform_fee_cents)}</td>
                <td className="px-4 py-3 font-mono">{formatUsd(job.driver_payout_cents)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-steel">
                  No paid jobs.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
