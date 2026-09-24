import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUS_LABEL, eventLabel, formatUsd, type JobStatus } from "@heft/shared";
import { Flash } from "@/components/flash";
import { resolveDispute, restoreDisputedJob } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { id } = await params;
  const { notice } = await searchParams;
  const { data: job } = await gate.supabase
    .from("jobs")
    .select("*, customer:users!jobs_customer_id_fkey(display_name, phone), driver:users!jobs_driver_id_fkey(display_name, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const { data: events } = await gate.supabase
    .from("job_events")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });
  const { data: photos } = await gate.supabase.from("job_photos").select("*").eq("job_id", id);
  const { data: disputes } = await gate.supabase
    .from("disputes")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false });
  const signed = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const bucket = photo.kind === "pod" ? "pod" : "job-photos";
      const { data } = await gate.supabase.storage.from(bucket).createSignedUrl(photo.storage_path, 60 * 60);
      return { ...photo, url: data?.signedUrl ?? null };
    }),
  );
  const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
  const driver = Array.isArray(job.driver) ? job.driver[0] : job.driver;

  return (
    <main className="max-w-4xl">
      <Link href="/jobs" className="text-xs font-semibold uppercase tracking-wider text-steel">
        Jobs
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">{job.item_description}</h1>
      <p className="mt-2 text-sm text-steel">{STATUS_LABEL[job.status as JobStatus] ?? job.status}</p>
      <Flash notice={notice} />
      <dl className="mt-6 grid gap-4 border border-line bg-white p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-steel">Pickup</dt>
          <dd className="mt-1 text-sm">{job.pickup_address}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-steel">Drop-off</dt>
          <dd className="mt-1 text-sm">{job.dropoff_address}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-steel">Customer</dt>
          <dd className="mt-1 text-sm">{customer?.display_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-steel">Driver</dt>
          <dd className="mt-1 text-sm">{driver?.display_name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-steel">Price</dt>
          <dd className="mt-1 font-mono text-sm">{formatUsd(job.final_cents ?? job.estimate_cents)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-steel">Platform fee / driver payout</dt>
          <dd className="mt-1 font-mono text-sm">
            {formatUsd(job.platform_fee_cents)} / {formatUsd(job.driver_payout_cents)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-steel">Payment intent</dt>
          <dd className="mt-1 font-mono text-sm">{job.stripe_payment_intent_id ?? "—"}</dd>
        </div>
      </dl>
      {(disputes ?? []).map((dispute) => (
        <section key={dispute.id} className="mt-4 border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Dispute · {dispute.status}</p>
          <p className="mt-2 text-sm">{dispute.reason}</p>
          {dispute.resolution_notes ? <p className="mt-2 text-sm text-steel">{dispute.resolution_notes}</p> : null}
          {dispute.status === "open" || dispute.status === "investigating" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <DisputeButton id={dispute.id} jobId={job.id} status="investigating" label="Mark investigating" />
              <DisputeButton id={dispute.id} jobId={job.id} status="resolved_customer" label="Resolve for customer" />
              <DisputeButton id={dispute.id} jobId={job.id} status="resolved_driver" label="Resolve for driver" />
              <DisputeButton id={dispute.id} jobId={job.id} status="closed" label="Close" />
            </div>
          ) : null}
          <form action={resolveDispute} className="mt-4 grid gap-3">
            <input type="hidden" name="id" value={dispute.id} />
            <input type="hidden" name="return_to" value={`/jobs/${job.id}`} />
            <label className="text-xs font-semibold uppercase tracking-wider text-steel">
              Resolution notes
              <textarea
                name="resolution_notes"
                defaultValue={dispute.resolution_notes ?? ""}
                className="mt-1 min-h-20 w-full border border-line px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-steel">
              Status
              <select name="status" defaultValue={dispute.status} className="mt-1 w-full border border-line px-2 py-2 text-sm">
                {["open", "investigating", "resolved_customer", "resolved_driver", "closed"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-10 w-fit bg-charcoal px-4 text-sm font-semibold text-paper" type="submit">
              Save resolution
            </button>
          </form>
        </section>
      ))}
      {job.status === "disputed" ? (
        <form action={restoreDisputedJob} className="mt-4 border border-amber bg-white p-4">
          <input type="hidden" name="job_id" value={job.id} />
          <p className="text-sm">Restore the status from before the dispute. This does not refund the hold.</p>
          <button className="mt-3 h-10 bg-charcoal px-4 text-sm font-semibold text-paper" type="submit">
            Restore previous status
          </button>
        </form>
      ) : null}
      <h2 className="mt-8 text-lg font-semibold">Photos</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {signed.map((photo) => (
          <li key={photo.id} className="border border-line bg-white p-2">
            <p className="px-1 text-xs uppercase tracking-wider text-steel">{photo.kind}</p>
            {photo.url ? (
              // Signed URL from our storage bucket.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={photo.kind} className="mt-2 h-40 w-full object-cover" />
            ) : (
              <p className="mt-2 text-sm text-steel">No signed URL</p>
            )}
          </li>
        ))}
        {signed.length === 0 ? <li className="text-sm text-steel">No photos.</li> : null}
      </ul>
      <h2 className="mt-8 text-lg font-semibold">Timeline</h2>
      <ol className="mt-3 border-l-2 border-amber pl-4">
        {(events ?? []).map((event) => (
          <li key={event.id} className="mb-4">
            <p className="text-sm font-semibold">{eventLabel(event.type)}</p>
            <p className="text-xs text-steel">{new Date(event.created_at).toLocaleString()}</p>
            <p className="mt-1 text-sm text-steel">{payloadLine(event.payload)}</p>
          </li>
        ))}
        {(events ?? []).length === 0 ? <li className="text-sm text-steel">No events yet.</li> : null}
      </ol>
    </main>
  );
}

function DisputeButton({ id, jobId, status, label }: { id: string; jobId: string; status: string; label: string }) {
  return (
    <form action={resolveDispute}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_to" value={`/jobs/${jobId}`} />
      <button className="h-10 border border-charcoal px-3 text-sm font-semibold" type="submit">
        {label}
      </button>
    </form>
  );
}

function payloadLine(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const bits: string[] = [];
  if (typeof record.from === "string" && typeof record.to === "string") bits.push(`${record.from} → ${record.to}`);
  if (typeof record.cancel_reason === "string" && record.cancel_reason) bits.push(record.cancel_reason);
  if (typeof record.note === "string") bits.push(record.note);
  if (record.seed === "demo") bits.push("Sample seed event");
  return bits.join(" · ");
}
