import Link from "next/link";
import { JOB_STATUSES, STATUS_LABEL, formatUsd } from "@heft/shared";
import { requireAdmin } from "@/lib/auth";

export default async function DashboardPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { supabase } = gate;

  const counts = await Promise.all(
    JOB_STATUSES.map(async (status) => {
      const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", status);
      return [status, count ?? 0] as const;
    }),
  );

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data: paidEvents } = await supabase
    .from("job_events")
    .select("job_id, created_at")
    .eq("type", "paid")
    .gte("created_at", start.toISOString());
  const todayIds = [...new Set((paidEvents ?? []).map((event) => event.job_id))];
  let todayFee = 0;
  if (todayIds.length > 0) {
    const { data: paidJobs } = await supabase.from("jobs").select("platform_fee_cents").in("id", todayIds);
    todayFee = (paidJobs ?? []).reduce((sum, job) => sum + (job.platform_fee_cents ?? 0), 0);
  }

  const { count: driverCount } = await supabase
    .from("driver_profiles")
    .select("user_id", { count: "exact", head: true });
  const { count: pendingDrivers } = await supabase
    .from("driver_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: openDisputes } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "investigating"]);
  const openJobs = counts.find(([status]) => status === "open")?.[1] ?? 0;

  return (
    <main>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-steel">Today, UTC</p>
        <h1 className="mt-2 text-3xl font-semibold">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
          Counts and revenue are read from this database. There is no sample traffic. A zero means no matching rows.
        </p>
      </header>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Open jobs</p>
          <p className="mt-3 font-mono text-3xl">{openJobs}</p>
          <Link href="/jobs" className="mt-2 inline-block text-xs font-semibold text-charcoal underline">
            View jobs
          </Link>
        </article>
        <article className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Platform revenue today</p>
          <p className="mt-3 font-mono text-3xl">{formatUsd(todayFee)}</p>
          <p className="mt-2 text-xs text-steel">Sum of platform_fee_cents on jobs with a paid event since 00:00 UTC.</p>
        </article>
        <article className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Drivers awaiting approval</p>
          <p className="mt-3 font-mono text-3xl">{pendingDrivers ?? 0}</p>
          <p className="mt-2 text-xs text-steel">{driverCount ?? 0} driver profiles total.</p>
          <Link href="/drivers" className="mt-2 inline-block text-xs font-semibold text-charcoal underline">
            Review drivers
          </Link>
        </article>
        <article className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Open disputes</p>
          <p className="mt-3 font-mono text-3xl">{openDisputes ?? 0}</p>
          <Link href="/disputes" className="mt-2 inline-block text-xs font-semibold text-charcoal underline">
            Review
          </Link>
        </article>
      </section>
      <section className="mt-8 border border-line bg-white">
        <h2 className="border-b border-line px-5 py-4 text-sm font-semibold">Jobs by status</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(([status, count]) => (
            <li key={status} className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
              <span>{STATUS_LABEL[status]}</span>
              <span className="font-mono">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
