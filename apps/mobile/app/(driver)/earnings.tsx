import { Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { formatUsd, loadFailureCopy, type Payout } from "@heft/shared";
import { BottomNav, EmptyState, Screen } from "../../src/components/ui";
import { supabase } from "../../src/lib/supabase";

const NAV = [
  { href: "/(driver)/map" as const, label: "Map" },
  { href: "/(driver)/earnings" as const, label: "Earnings" },
  { href: "/(driver)/account" as const, label: "Account" },
];

type Row = Payout & { jobs: { item_description: string } | { item_description: string }[] | null };

export default function Earnings() {
  const payouts = useQuery({
    queryKey: ["earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*, jobs(item_description)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });
  const total = (payouts.data ?? []).reduce((sum, row) => sum + row.amount_cents, 0);

  return (
    <Screen title="Earnings" footer={<BottomNav items={NAV} />}>
      <Text className="text-xs font-semibold uppercase tracking-wider text-steel">Recorded payouts</Text>
      <Text className="mt-2 font-mono text-4xl text-charcoal">{formatUsd(total)}</Text>
      <Text className="mb-6 mt-2 text-sm leading-5 text-steel">
        Pending means the row exists and Connect has not transferred it. Sandbox completions stay pending. This is not a projected forecast.
      </Text>
      {payouts.isLoading ? <EmptyState title="Loading earnings" body="Reading recorded payouts. A fresh database stays at $0.00." /> : null}
      {payouts.isError ? (
        <EmptyState
          title={loadFailureCopy((payouts.error as Error).message).title}
          body={loadFailureCopy((payouts.error as Error).message).body}
        />
      ) : null}
      {(payouts.data ?? []).map((payout) => {
        const job = Array.isArray(payout.jobs) ? payout.jobs[0] : payout.jobs;
        return (
          <Text key={payout.id} className="mb-3 border border-line bg-white p-4 text-sm text-charcoal">
            {job?.item_description ?? "Job"} · {formatUsd(payout.amount_cents)} · {payout.status}
          </Text>
        );
      })}
      {payouts.isSuccess && payouts.data.length === 0 ? (
        <EmptyState title="No payouts yet" body="Complete a delivery with a proof photo. Sandbox payouts stay pending until Stripe Connect is set up." />
      ) : null}
    </Screen>
  );
}
