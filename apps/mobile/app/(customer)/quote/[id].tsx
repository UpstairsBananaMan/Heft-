import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { driversApprovedLabel, formatUsd, type Job } from "@heft/shared";
import { C, font, PrimaryButton } from "../../../src/components/v2";
import { demoMode, supabase } from "../../../src/lib/supabase";
import { errorText, invoke } from "../../../src/lib/invoke";

export default function QuoteConfirm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (queryError) throw queryError;
      return data as Job | null;
    },
  });
  const row = job.data;

  async function book() {
    setPending(true);
    setError("");
    try {
      await invoke("publish-job", { job_id: id });
      router.replace(`/job/${id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, padding: 20, paddingTop: 64 }}>
      <Text style={{ fontFamily: font.heading, fontSize: 28 }}>Your price</Text>
      {!row ? <Text style={{ marginTop: 12, color: C.steel }}>{job.isLoading ? " " : "Quote not found"}</Text> : null}
      {row ? (
        <>
          <Text style={{ marginTop: 8, fontFamily: font.display, fontSize: 44 }}>{formatUsd(row.final_cents ?? row.estimate_cents)}</Text>
          {(row.quote_lines ?? []).map((line) => (
            <View key={line.key} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontFamily: font.body, fontSize: 16 }}>{line.label}</Text>
              <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{formatUsd(line.cents)}</Text>
            </View>
          ))}
          <Text style={{ marginTop: 12, color: C.green, fontFamily: font.semi }}>{driversApprovedLabel()}</Text>
          {error ? <Text style={{ color: C.red, marginTop: 8 }}>{error}</Text> : null}
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label={pending ? "Booking…" : `Book for ${formatUsd(row.final_cents ?? row.estimate_cents)}`} disabled={pending} onPress={() => void book()} />
          </View>
          <Text style={{ textAlign: "center", marginTop: 8, color: C.steel }}>You're charged after delivery.</Text>
          {demoMode ? <Text style={{ textAlign: "center", marginTop: 4, color: C.steel, fontSize: 13 }}>Demo: no card is charged.</Text> : null}
        </>
      ) : null}
    </View>
  );
}
