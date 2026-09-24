import Link from "next/link";
import { STATUS_LABEL, formatUsd, type JobStatus } from "@heft/shared";
import { requireAdmin } from "@/lib/auth";

export default async function JobsPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: jobs } = await gate.supabase
    .from("jobs")
    .select("id, status, item_description, pickup_address, dropoff_address, final_cents, estimate_cents, created_at, customer:users!jobs_customer_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main>
      <h1 className="text-3xl font-semibold">Jobs</h1>
      <p className="mt-2 text-sm text-steel">Newest 200 rows. Empty until a customer publishes work.</p>
      <div className="mt-6 overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-steel">
            <tr>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Route</th>
              <th className="px-4 py-3 font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).map((job) => {
              const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
              return (
                <tr key={job.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-semibold underline">
                      {job.item_description}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{STATUS_LABEL[job.status as JobStatus] ?? job.status}</td>
                  <td className="px-4 py-3">{customer?.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-steel">
                    {job.pickup_address} → {job.dropoff_address}
                  </td>
                  <td className="px-4 py-3 font-mono">{formatUsd(job.final_cents ?? job.estimate_cents)}</td>
                </tr>
              );
            })}
            {(jobs ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-steel">
                  No jobs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
