import Link from "next/link";
import { resolveDispute } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["open", "investigating", "resolved_customer", "resolved_driver", "closed"];

export default async function DisputesPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: disputes } = await gate.supabase
    .from("disputes")
    .select("*, jobs(item_description, status)")
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1 className="text-3xl font-semibold">Disputes</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
        Resolving a dispute records notes only. Heft does not auto-refund. Reverse a capture in Stripe yourself if the
        notes say the customer should be refunded.
      </p>
      <ul className="mt-6 space-y-4">
        {(disputes ?? []).map((dispute) => {
          const job = Array.isArray(dispute.jobs) ? dispute.jobs[0] : dispute.jobs;
          return (
            <li key={dispute.id} className="border border-line bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/jobs/${dispute.job_id}`} className="font-semibold underline">
                  {job?.item_description ?? dispute.job_id}
                </Link>
                <span className="text-xs uppercase tracking-wider text-steel">{dispute.status}</span>
              </div>
              <p className="mt-3 text-sm">{dispute.reason}</p>
              <form action={resolveDispute} className="mt-4 grid gap-3">
                <input type="hidden" name="id" value={dispute.id} />
                <label className="text-xs font-semibold uppercase tracking-wider text-steel">
                  Status
                  <select name="status" defaultValue={dispute.status} className="mt-1 w-full border border-line px-2 py-2 text-sm">
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-steel">
                  Resolution notes
                  <textarea
                    name="resolution_notes"
                    defaultValue={dispute.resolution_notes ?? ""}
                    className="mt-1 min-h-24 w-full border border-line px-2 py-2 text-sm"
                  />
                </label>
                <button className="h-10 w-fit bg-charcoal px-4 text-sm font-semibold text-paper" type="submit">
                  Save resolution
                </button>
              </form>
            </li>
          );
        })}
        {(disputes ?? []).length === 0 ? <li className="text-sm text-steel">No disputes.</li> : null}
      </ul>
    </main>
  );
}
