import { useState } from "react";
import { Text } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SIZE_LABEL, VEHICLE_LABEL, formatUsd, type Job } from "@heft/shared";
import { Button, ErrorText, Notice, Screen } from "../../../src/components/ui";
import { errorText, invoke } from "../../../src/lib/invoke";
import { supabase } from "../../../src/lib/supabase";

export default function QuoteConfirm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (queryError) throw queryError;
      return data as Job;
    },
  });

  async function publish() {
    setPending(true);
    setError("");
    try {
      const result = await invoke<{ sandbox?: boolean }>("publish-job", { job_id: id });
      await queryClient.invalidateQueries({ queryKey: ["job", id] });
      await queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      router.replace(`/(customer)/job/${id}?sandbox=${result.sandbox ? "1" : "0"}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  const row = job.data;
  return (
    <Screen title="Quote" back>
      {!row ? <Text className="text-sm text-steel">Loading quote.</Text> : null}
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
          <Text className="mt-4 font-mono text-4xl text-charcoal">{formatUsd(row.estimate_cents)}</Text>
          <Text className="mt-2 text-sm leading-5 text-steel">
            Publishing places a hold for this amount. Capture happens after proof of delivery. Without Stripe keys the hold id is a sandbox PaymentIntent.
          </Text>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={pending ? "Authorizing" : "Authorize hold and publish"} disabled={pending || row.status !== "priced"} onPress={publish} />
          {row.status !== "priced" ? <Notice>This job is {row.status}. Quote it again from a draft if the price is missing.</Notice> : null}
        </>
      ) : null}
    </Screen>
  );
}
