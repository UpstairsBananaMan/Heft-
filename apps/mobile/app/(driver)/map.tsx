import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { formatUsd, type DriverProfile, type Job } from "@heft/shared";
import { JobMap } from "../../src/components/JobMap";
import { BottomNav, Button, EmptyState, Screen } from "../../src/components/ui";
import { track } from "../../src/lib/analytics";
import { errorText, invoke } from "../../src/lib/invoke";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";
import { toast } from "../../src/store/toast";

const NAV = [
  { href: "/(driver)/map" as const, label: "Map" },
  { href: "/(driver)/earnings" as const, label: "Earnings" },
  { href: "/(driver)/account" as const, label: "Account" },
];

export default function DriverMap() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
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
    enabled: driver.data?.status === "approved" && driver.data?.is_online === true,
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
    const { error } = await supabase.from("driver_profiles").update({ is_online: online }).eq("user_id", profile.id);
    if (error) {
      toast(error.message);
      return;
    }
    toast(online ? "You are online." : "You are offline.", "ok");
    await queryClient.invalidateQueries({ queryKey: ["driver-profile", profile.id] });
    await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
  }

  async function accept(jobId: string) {
    setAcceptingId(jobId);
    try {
      await invoke("accept-job", { job_id: jobId });
      await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
      track({ name: "job_accepted" });
      toast("Job accepted. Start toward pickup.", "ok");
      router.push(`/(driver)/job/${jobId}`);
    } catch (err) {
      toast(errorText(err));
    } finally {
      setAcceptingId(null);
    }
  }

  const row = driver.data;
  const openJobs = jobs.data ?? [];

  return (
    <Screen title="Open jobs" footer={<BottomNav items={NAV} />}>
      {!driver.isLoading && !row ? (
        <>
          <EmptyState title="No vehicle on file" body="Add a truck and a Pensacola service circle. An admin has to approve you before jobs show up." />
          <Button label="Set up vehicle" onPress={() => router.push("/(driver)/setup")} />
        </>
      ) : null}
      {row?.status === "pending" ? (
        <EmptyState
          title="Waiting on approval"
          body="This vehicle is pending. You cannot go online or accept jobs yet. An admin must tap Approve on the website. Come back after that and tap Go online."
        />
      ) : null}
      {row?.status === "suspended" ? (
        <EmptyState title="Vehicle suspended" body="Dispatch suspended this profile. You cannot accept jobs until an admin clears it." />
      ) : null}
      {row?.status === "approved" ? (
        <Button
          label={row.is_online ? "Go offline" : "Go online"}
          tone={row.is_online ? "charcoal" : "amber"}
          onPress={() => void setOnline(!row.is_online)}
        />
      ) : null}
      {row?.status === "approved" && !row.is_online ? (
        <EmptyState title="You are offline" body="Go online to load open jobs inside your service circle. The list stays empty until then." />
      ) : null}
      {row?.is_online && jobs.error ? <EmptyState title="Could not load jobs" body={(jobs.error as Error).message} /> : null}
      {row?.is_online && jobs.isSuccess && openJobs.length === 0 ? (
        <EmptyState title="No open jobs in range" body="Stay online. New publishes inside your radius and vehicle class will land here." />
      ) : null}
      {openJobs.length > 0 ? (
        <View className="mb-4">
          <JobMap
            pins={openJobs.map((job) => ({
              id: job.id,
              lat: job.pickup_lat,
              lng: job.pickup_lng,
              title: job.item_description,
              onPress: () => router.push(`/(driver)/job/${job.id}`),
            }))}
          />
        </View>
      ) : null}
      {openJobs.length > 0 ? (
        <Pressable onPress={() => void jobs.refetch()} className="mb-3 self-start">
          <Text className="text-xs font-semibold uppercase tracking-wider text-steel">Refresh list</Text>
        </Pressable>
      ) : null}
      {openJobs.map((job) => (
        <View key={job.id} className="mb-3 border border-line bg-white p-4">
          <Pressable onPress={() => router.push(`/(driver)/job/${job.id}`)}>
            <Text className="text-base font-semibold text-charcoal">{job.item_description}</Text>
            <Text className="mt-1 text-sm text-steel">{job.pickup_address}</Text>
            <Text className="mt-1 text-sm text-steel">→ {job.dropoff_address}</Text>
            <Text className="mt-2 font-mono text-sm text-charcoal">{formatUsd(job.driver_payout_cents)} payout</Text>
          </Pressable>
          <Button
            label={acceptingId === job.id ? "Accepting" : "Accept"}
            disabled={acceptingId != null}
            onPress={() => void accept(job.id)}
          />
        </View>
      ))}
    </Screen>
  );
}
