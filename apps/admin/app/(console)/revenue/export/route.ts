import { toCsv } from "@heft/shared";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.configured) return new Response("Admin is not configured", { status: 503 });
  const { data, error } = await gate.supabase
    .from("jobs")
    .select("id, item_description, final_cents, platform_fee_cents, driver_payout_cents, updated_at")
    .eq("status", "paid")
    .order("updated_at", { ascending: false });
  if (error) return new Response(error.message, { status: 500 });
  const csv = toCsv(
    ["job_id", "item_description", "gross_cents", "platform_fee_cents", "driver_payout_cents", "updated_at"],
    (data ?? []).map((job) => [
      job.id,
      job.item_description ?? "",
      String(job.final_cents ?? 0),
      String(job.platform_fee_cents ?? 0),
      String(job.driver_payout_cents ?? 0),
      job.updated_at ?? "",
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="heft-revenue.csv"',
    },
  });
}
