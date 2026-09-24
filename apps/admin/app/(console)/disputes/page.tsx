import Link from "next/link";
import { Flash } from "@/components/flash";
import { resolveDispute } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["open", "investigating", "resolved_customer", "resolved_driver", "closed"];
const QUEUE = new Set(["open", "investigating"]);

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { notice } = await searchParams;
  const { data: disputes } = await gate.supabase
    .from("disputes")
    .select("*, jobs(item_description, status)")
    .order("created_at", { ascending: false });

  const rows = disputes ?? [];
  const queue = rows.filter((dispute) => QUEUE.has(dispute.status));
  const done = rows.filter((dispute) => !QUEUE.has(dispute.status));

  return (
    <main>
      <h1 className="text-3xl font-semibold">Disputes</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
        Resolving a dispute records notes only. Heft does not auto-refund. Reverse a capture in Stripe yourself if the
        notes say the customer should be refunded.
      </p>
      <Flash notice={notice} />
      <Queue title="Needs a decision" rows={queue} empty="No open disputes." />
      <Queue title="Closed" rows={done} empty="Nothing closed yet." />
    </main>
  );
}

function Queue({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{
    id: string;
    job_id: string;
    status: string;
    reason: string;
    resolution_notes: string | null;
    created_at: string;
    jobs: { item_description?: string; status?: string } | { item_description?: string; status?: string }[] | null;
  }>;
  empty: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-steel">{title}</h2>
      <ul className="mt-4 space-y-4">
        {rows.map((dispute) => {
          const job = Array.isArray(dispute.jobs) ? dispute.jobs[0] : dispute.jobs;
          return (
            <li key={dispute.id} className="border border-line bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/jobs/${dispute.job_id}`} className="font-semibold underline">
                  {job?.item_description ?? dispute.job_id}
                </Link>
                <span className="text-xs uppercase tracking-wider text-steel">{dispute.status}</span>
              </div>
              <p className="mt-2 text-xs text-steel">{new Date(dispute.created_at).toLocaleString()}</p>
              <p className="mt-3 text-sm">{dispute.reason}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {dispute.status === "open" ? (
                  <Quick status="investigating" id={dispute.id} label="Mark investigating" />
                ) : null}
                {dispute.status === "open" || dispute.status === "investigating" ? (
                  <>
                    <Quick status="resolved_customer" id={dispute.id} label="Resolve for customer" />
                    <Quick status="resolved_driver" id={dispute.id} label="Resolve for driver" />
                    <Quick status="closed" id={dispute.id} label="Close" />
                  </>
                ) : null}
              </div>
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
        {rows.length === 0 ? <li className="text-sm text-steel">{empty}</li> : null}
      </ul>
    </section>
  );
}

function Quick({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={resolveDispute}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="h-10 border border-charcoal px-3 text-sm font-semibold" type="submit">
        {label}
      </button>
    </form>
  );
}
