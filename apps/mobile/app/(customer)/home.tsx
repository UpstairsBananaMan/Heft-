import { Pressable, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { formatUsd, loadFailureCopy, type Job } from "@heft/shared";
import { BottomNav, Button, EmptyState, Screen, StatusPill } from "../../src/components/ui";
import { supabase } from "../../src/lib/supabase";
import { toast } from "../../src/store/toast";

const NAV = [
  { href: "/(customer)/home" as const, label: "Jobs" },
  { href: "/(customer)/new" as const, label: "New" },
  { href: "/(customer)/account" as const, label: "Account" },
];

export default function CustomerHome() {
  const router = useRouter();
  const jobs = useQuery({
    queryKey: ["my-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });

  const rows = jobs.data ?? [];
  const failed = jobs.error ? loadFailureCopy((jobs.error as Error).message) : null;

  return (
    <Screen title="Your jobs" footer={<BottomNav items={NAV} />}>
      <Pressable
        onPress={() => {
          void jobs.refetch().catch((err: Error) => toast(err.message));
        }}
        className="mb-4 self-start"
      >
        <Text className="text-xs font-semibold uppercase tracking-wider text-steel">Refresh</Text>
      </Pressable>
      {jobs.isLoading ? <EmptyState title="Loading jobs" body="Fetching your requests." /> : null}
      {failed ? <EmptyState title={failed.title} body={failed.body} /> : null}
      {!failed && jobs.isSuccess && rows.length === 0 ? (
        <>
          <EmptyState title="No jobs yet" body="Post a pickup and drop-off. You will see a price before anyone is dispatched." />
          <Button label="New request" onPress={() => router.push("/(customer)/new")} />
        </>
      ) : null}
      {rows.map((job) => (
        <Pressable
          key={job.id}
          onPress={() => router.push(`/job/${job.id}`)}
          className="mb-3 border border-line bg-white p-4"
        >
          <StatusPill status={job.status} />
          <Text className="mt-3 text-lg font-semibold text-charcoal">{job.item_description}</Text>
          <Text className="mt-1 text-sm text-steel">
            {job.pickup_address} → {job.dropoff_address}
          </Text>
          <Text className="mt-2 font-mono text-sm text-charcoal">{formatUsd(job.final_cents ?? job.estimate_cents)}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
