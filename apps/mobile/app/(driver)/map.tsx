import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { formatUsd, type DriverProfile, type Job } from "@heft/shared";
import { JobMap } from "../../src/components/JobMap";
import { BottomNav, Button, Notice, Screen, StatusPill } from "../../src/components/ui";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

const NAV = [
  { href: "/(driver)/map" as const, label: "Map" },
  { href: "/(driver)/earnings" as const, label: "Earnings" },
  { href: "/(driver)/account" as const, label: "Account" },
];

export default function DriverMap() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const driver = useQuery({
    queryKey: ["driver-profile", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*").eq("user_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data as DriverProfile | null;
    },
  });
  const jobs = useQuery({
    queryKey: ["open-jobs", driver.data?.is_online, driver.data?.status],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("status", "open").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
    refetchInterval: 12000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("open-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  async function setOnline(online: boolean) {
    if (!profile) return;
    await supabase.from("driver_profiles").update({ is_online: online }).eq("user_id", profile.id);
    await queryClient.invalidateQueries({ queryKey: ["driver-profile", profile.id] });
    await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
  }

  const row = driver.data;
  return (
    <Screen title="Open jobs" footer={<BottomNav items={NAV} />}>
      {!row ? (
        <>
          <Notice>Add a vehicle before you can take work.</Notice>
          <Button label="Set up vehicle" onPress={() => router.push("/(driver)/setup")} />
        </>
      ) : null}
      {row?.status === "pending" ? (
        <Notice>Approval is pending. An admin must approve this vehicle before open jobs appear.</Notice>
      ) : null}
      {row?.status === "suspended" ? <Notice>This vehicle is suspended. Contact dispatch.</Notice> : null}
      {row?.status === "approved" ? (
        <Button
          label={row.is_online ? "Go offline" : "Go online"}
          tone={row.is_online ? "charcoal" : "amber"}
          onPress={() => void setOnline(!row.is_online)}
        />
      ) : null}
      {row?.status === "approved" && !row.is_online ? (
        <Text className="my-3 text-sm text-steel">Go online to see open jobs inside your service circle.</Text>
      ) : null}
      <View className="mt-4">
        <JobMap
          pins={(jobs.data ?? []).map((job) => ({
            id: job.id,
            lat: job.pickup_lat,
            lng: job.pickup_lng,
            title: job.item_description,
            onPress: () => router.push(`/(driver)/job/${job.id}`),
          }))}
        />
      </View>
      <Pressable onPress={() => jobs.refetch()} className="my-3 self-start">
        <Text className="text-xs font-semibold uppercase tracking-wider text-steel">Refresh</Text>
      </Pressable>
      {(jobs.data ?? []).map((job) => (
        <Pressable key={job.id} onPress={() => router.push(`/(driver)/job/${job.id}`)} className="mb-3 border border-line bg-white p-4">
          <StatusPill status={job.status} />
          <Text className="mt-2 text-base font-semibold text-charcoal">{job.item_description}</Text>
          <Text className="mt-1 text-sm text-steel">{job.pickup_address}</Text>
          <Text className="mt-2 font-mono text-sm">{formatUsd(job.driver_payout_cents)} payout</Text>
        </Pressable>
      ))}
      {row?.is_online && jobs.data?.length === 0 ? <Text className="text-sm text-steel">No open jobs in range.</Text> : null}
    </Screen>
  );
}
