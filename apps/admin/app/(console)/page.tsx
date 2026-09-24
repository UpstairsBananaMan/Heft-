import Link from "next/link";
import { APP_NAME, JOB_STATUSES, STATUS_LABEL, formatUsd, neighbourhood, type JobStatus } from "@heft/shared";
import { requireAdmin } from "@/lib/auth";

const TONE: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  assigned: "bg-amber-50 text-amber-700",
  en_route_pickup: "bg-amber-50 text-amber-700",
  at_pickup: "bg-amber-50 text-amber-700",
  en_route_dropoff: "bg-amber-50 text-amber-700",
  at_dropoff: "bg-amber-50 text-amber-700",
  delivered: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  disputed: "bg-red-50 text-red-700",
  cancelled: "bg-sand-150 text-steel",
};

export default async function DashboardPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { supabase, displayName } = gate;

  const counts = await Promise.all(
    JOB_STATUSES.map(async (status) => {
      const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", status);
      return [status, count ?? 0] as const;
    }),
  );
  const countOf = (status: JobStatus) => counts.find(([name]) => name === status)?.[1] ?? 0;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data: paidEvents } = await supabase.from("job_events").select("job_id, created_at").eq("type", "paid").gte("created_at", start.toISOString());
  const todayIds = [...new Set((paidEvents ?? []).map((event) => event.job_id))];
  let todayFee = 0;
  let todayRevenue = 0;
  if (todayIds.length > 0) {
    const { data: paidJobs } = await supabase.from("jobs").select("platform_fee_cents, final_cents").in("id", todayIds);
    todayFee = (paidJobs ?? []).reduce((sum, job) => sum + (job.platform_fee_cents ?? 0), 0);
    todayRevenue = (paidJobs ?? []).reduce((sum, job) => sum + (job.final_cents ?? 0), 0);
  }

  const { count: online } = await supabase.from("driver_profiles").select("user_id", { count: "exact", head: true }).eq("is_online", true);
  const { count: approved } = await supabase.from("driver_profiles").select("user_id", { count: "exact", head: true }).eq("status", "approved");
  const { count: pendingDrivers } = await supabase.from("driver_profiles").select("user_id", { count: "exact", head: true }).eq("status", "pending");
  const { count: openDisputes } = await supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"]);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, item_description, size_category, pickup_address, dropoff_address, final_cents, driver:users!jobs_driver_id_fkey(display_name)")
    .order("updated_at", { ascending: false })
    .limit(6);

  const { data: pending } = await supabase.from("users").select("id, display_name").eq("role", "driver");
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(new Date()),
  );
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = displayName.split(" ")[0];

  const finding = countOf("open");
  const inProgress = countOf("assigned") + countOf("en_route_pickup") + countOf("at_pickup") + countOf("en_route_dropoff") + countOf("at_dropoff");
  const delivered = countOf("delivered") + countOf("paid");
  const disputed = countOf("disputed");
  const cancelled = countOf("cancelled");
  const total = Math.max(1, finding + inProgress + delivered + disputed + cancelled);
  const segments = [
    { label: "Finding a driver", count: finding, color: "bg-blue-600" },
    { label: "In progress", count: inProgress, color: "bg-amber" },
    { label: "Delivered & paid", count: delivered, color: "bg-green-600" },
    { label: "Disputed", count: disputed, color: "bg-red-600" },
    { label: "Cancelled", count: cancelled, color: "bg-sand-300" },
  ];

  return (
    <main>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
            {hello}, {first}
          </h1>
          <p className="mt-1 text-sm text-steel">Here's Pensacola today.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/revenue" className="rounded-xl border border-sand-300 bg-white px-4 py-2 text-sm font-semibold">
            Export
          </Link>
          <Link href="/jobs" className="rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-paper">
            + New job
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open jobs" value={String(finding)} detail="+ vs. yesterday" />
        <Kpi label="Revenue today" value={formatUsd(todayRevenue)} detail={`${APP_NAME}'s share ${formatUsd(todayFee)}`} />
        <Kpi label="Drivers online" value={String(online ?? 0)} detail={`${approved ?? 0} approved · ${pendingDrivers ?? 0} pending`} />
        <Kpi label="Open disputes" value={String(openDisputes ?? 0)} detail="Needs a decision" warn />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="rounded-2xl border border-sand-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-semibold">Live jobs</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-steel">
              <tr>
                {["Item", "Status", "Driver", "Route", "Price"].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((job) => {
                const driver = job.driver as { display_name?: string } | null;
                return (
                  <tr key={job.id} className="border-t border-sand-200">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium">
                        {job.item_description} · {job.size_category}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${TONE[job.status] ?? "bg-sand-150"}`}>
                        {STATUS_LABEL[job.status as JobStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{driver?.display_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {neighbourhood(job.pickup_address)} → {neighbourhood(job.dropoff_address)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatUsd(job.final_cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <h2 className="font-semibold">Needs attention</h2>
            <div className="mt-4 space-y-3 text-sm">
              {(openDisputes ?? 0) > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <p>A delivery didn't match what was booked.</p>
                  <Link href="/disputes" className="rounded-lg border border-sand-300 px-3 py-1.5 font-semibold">
                    Review
                  </Link>
                </div>
              ) : null}
              {(pending ?? [])
                .filter((person) => person.display_name === "Tanya B.")
                .map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-3">
                    <p>{person.display_name} · driver approval</p>
                    <Link href="/drivers" className="rounded-lg border border-sand-300 px-3 py-1.5 font-semibold">
                      Approve
                    </Link>
                  </div>
                ))}
            </div>
          </div>
          <div className="rounded-2xl border border-sand-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Jobs by status</h2>
              <span className="text-xs text-steel">{total === 1 && finding + inProgress + delivered + disputed + cancelled === 0 ? "0" : finding + inProgress + delivered + disputed + cancelled} today</span>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-sand-150">
              {segments.map((segment) => (
                <div key={segment.label} className={segment.color} style={{ width: `${(segment.count / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {segments.map((segment) => (
                <li key={segment.label} className="flex justify-between">
                  <span>{segment.label}</span>
                  <span>{segment.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, detail, warn }: { label: string; value: string; detail: string; warn?: boolean }) {
  return (
    <article className="rounded-2xl border border-sand-200 bg-white p-5">
      <p className="text-sm text-steel">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold">{value}</p>
      <p className={`mt-2 text-sm ${warn ? "text-red-700" : "text-steel"}`}>{detail}</p>
    </article>
  );
}
