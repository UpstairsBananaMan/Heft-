import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SIZE_LABEL, VEHICLE_LABEL, formatUsd, loadFailureCopy, type Job } from "@heft/shared";
import { Button, EmptyState, Notice, Screen, Steps } from "../../../src/components/ui";
import { track } from "../../../src/lib/analytics";
import { errorText, invoke } from "../../../src/lib/invoke";
import { supabase } from "../../../src/lib/supabase";
import { toast } from "../../../src/store/toast";

export default function QuoteConfirm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (queryError) throw queryError;
      if (!data) throw new Error("Quote not found.");
      return data as Job;
    },
  });

  async function publish() {
    setPending(true);
    try {
      const result = await invoke<{ sandbox?: boolean }>("publish-job", { job_id: id });
      await queryClient.invalidateQueries({ queryKey: ["job", id] });
      await queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      track({ name: "job_published", sandbox: Boolean(result.sandbox) });
      toast(result.sandbox ? "Published with a sandbox payment hold." : "Hold authorized. Job is open.", "ok");
      router.replace(`/job/${id}?sandbox=${result.sandbox ? "1" : "0"}`);
    } catch (err) {
      toast(errorText(err));
    } finally {
      setPending(false);
    }
  }

  const row = job.data;
  return (
    <Screen title="Quote" back>
      <Steps labels={["Stops", "Load", "Price"]} current={2} />
      {job.isLoading ? <EmptyState title="Loading the quote" body="The price appears after the server measures the stops." /> : null}
      {job.error ? (
        <EmptyState title={loadFailureCopy((job.error as Error).message).title} body={loadFailureCopy((job.error as Error).message).body} />
      ) : null}
      {row ? (
        <>
          <Text className="text-lg font-semibold text-charcoal">{row.item_description}</Text>
          <Text className="mt-2 text-sm leading-5 text-steel">
            {row.pickup_address}
            {"\n"}→ {row.dropoff_address}
          </Text>
          <Text className="mt-4 text-sm text-steel">
            {SIZE_LABEL[row.size_category]} · {VEHICLE_LABEL[row.vehicle_required]} · {Number(row.distance_miles ?? 0).toFixed(2)} mi
          </Text>
          <View className="my-4 border border-line bg-white px-4 py-5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-steel">Customer total</Text>
            <Text className="mt-2 font-mono text-4xl text-charcoal">{formatUsd(row.estimate_cents)}</Text>
            <Text className="mt-3 text-sm leading-5 text-steel">
              This is a hold, not a capture. The card is charged after proof of delivery. Without Stripe keys the hold id starts with pi_sandbox_.
            </Text>
          </View>
          {row.status !== "priced" ? (
            <Notice>This job is {row.status}. Go back and quote the draft again if the price is missing.</Notice>
          ) : null}
          <Button
            label={pending ? "Authorizing hold" : "Authorize hold and publish"}
            disabled={pending || row.status !== "priced" || row.estimate_cents == null}
            onPress={publish}
          />
          <Button label="Edit request" tone="ghost" onPress={() => router.back()} />
        </>
      ) : null}
    </Screen>
  );
}
