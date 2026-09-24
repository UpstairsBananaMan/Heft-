import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CUSTOMER_STATUS, formatUsd, type Job } from "@heft/shared";
import { ArtSlot } from "../../../src/components/slots";
import { C, font, PrimaryButton } from "../../../src/components/v2";
import { supabase } from "../../../src/lib/supabase";

const ACTIVE = ["open", "assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"];

export default function Deliveries() {
  const router = useRouter();
  const jobs = useQuery({
    queryKey: ["my-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
  const rows = jobs.data ?? [];
  const current = rows.filter((job) => ACTIVE.includes(job.status));
  const past = rows.filter((job) => !ACTIVE.includes(job.status) && job.status !== "draft" && job.status !== "priced");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, paddingTop: 64 }}>
      <Text style={{ fontFamily: font.heading, fontSize: 28, color: C.ink, marginBottom: 16 }}>My deliveries</Text>
      {jobs.isLoading ? <Text style={{ color: C.steel }}> </Text> : null}
      {!jobs.isLoading && rows.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <ArtSlot name="Empty deliveries" />
          <Text style={{ marginTop: 12, fontFamily: font.heading, fontSize: 20 }}>No deliveries yet</Text>
          <Text style={{ marginTop: 6, color: C.steel, fontFamily: font.body, fontSize: 16, textAlign: "center" }}>
            Book your first one. You'll see the price before you pay anything.
          </Text>
          <View style={{ marginTop: 16, alignSelf: "stretch" }}>
            <PrimaryButton label="Book a delivery" onPress={() => router.push("/(customer)/home")} />
          </View>
        </View>
      ) : null}
      <Section title="In progress" jobs={current} />
      <Section title="Past" jobs={past} />
    </ScrollView>
  );
}

function Section({ title, jobs }: { title: string; jobs: Job[] }) {
  const router = useRouter();
  if (!jobs.length) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontFamily: font.semi, fontSize: 12, letterSpacing: 0.8, color: C.steel, marginBottom: 8 }}>{title.toUpperCase()}</Text>
      {jobs.map((job) => (
        <Pressable key={job.id} onPress={() => router.push(`/job/${job.id}`)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{job.item_description}</Text>
          <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14, marginTop: 4 }}>{CUSTOMER_STATUS[job.status]}</Text>
          <Text style={{ marginTop: 8, fontFamily: font.heading, fontSize: 18 }}>{formatUsd(job.final_cents ?? job.estimate_cents)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
