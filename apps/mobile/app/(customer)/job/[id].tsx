import { useEffect, useState } from "react";
import { Linking, Platform, Text } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatUsd, type DriverProfile, type Job, type JobEvent } from "@heft/shared";
import { JobMap } from "../../../src/components/JobMap";
import { CancelBox, DisputeBox } from "../../../src/components/JobActions";
import { Button, Notice, Screen, StatusPill } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import { useSession } from "../../../src/store/session";

export default function CustomerJob() {
  const { id, sandbox } = useLocalSearchParams<{ id: string; sandbox?: string }>();
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const [paidAt, setPaidAt] = useState<string | null>(null);

  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Job;
    },
  });

  const driver = useQuery({
    queryKey: ["driver-location", job.data?.driver_id],
    enabled: Boolean(job.data?.driver_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("*")
        .eq("user_id", job.data!.driver_id!)
        .maybeSingle();
      if (error) throw error;
      return data as DriverProfile | null;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`customer-job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["job", id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_profiles" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["driver-location"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (job.data?.status !== "paid") return;
    void supabase
      .from("job_events")
      .select("created_at")
      .eq("job_id", id)
      .eq("type", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPaidAt((data as JobEvent | null)?.created_at ?? null));
  }, [id, job.data?.status]);

  const row = job.data;
  const pins = [];
  if (row) {
    pins.push({ id: "pickup", lat: row.pickup_lat, lng: row.pickup_lng, title: "Pickup" });
    pins.push({ id: "dropoff", lat: row.dropoff_lat, lng: row.dropoff_lng, title: "Drop-off" });
  }
  if (driver.data?.current_lat != null && driver.data.current_lng != null) {
    pins.push({
      id: "driver",
      lat: driver.data.current_lat,
      lng: driver.data.current_lng,
      title: "Driver",
    });
  }

  function openMap(lat: number, lng: number) {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    if (url) void Linking.openURL(url);
  }

  return (
    <Screen title="Job" back>
      {sandbox === "1" ? <Notice>Payment hold is a sandbox PaymentIntent. No card was charged.</Notice> : null}
      {!row ? <Text className="text-sm text-steel">Loading.</Text> : null}
      {row ? (
        <>
          <StatusPill status={row.status} />
          <Text className="mt-3 text-xl font-semibold text-charcoal">{row.item_description}</Text>
          <Text className="mt-2 font-mono text-lg">{formatUsd(row.final_cents ?? row.estimate_cents)}</Text>
          <Text className="mt-3 text-sm leading-5 text-steel">
            Pickup {row.pickup_address}
            {"\n"}Drop-off {row.dropoff_address}
          </Text>
          {row.status === "cancelled" && row.cancel_reason ? (
            <Notice>Cancelled. {row.cancel_reason}</Notice>
          ) : null}
          {row.status === "disputed" ? <Notice>A dispute is open. Dispatch reviews it in the admin console.</Notice> : null}
          {row.stripe_payment_intent_id ? (
            <Text className="mt-2 font-mono text-xs text-steel">{row.stripe_payment_intent_id}</Text>
          ) : null}
          <JobMap pins={pins} />
          {driver.data?.current_lat != null ? (
            <Text className="mt-2 text-xs text-steel">
              Driver location {Number(driver.data.current_lat).toFixed(4)}, {Number(driver.data.current_lng).toFixed(4)}
              {driver.data.last_seen_at ? ` · ${new Date(driver.data.last_seen_at).toLocaleTimeString()}` : ""}
            </Text>
          ) : null}
          <Button label="Open pickup in maps" tone="ghost" onPress={() => openMap(row.pickup_lat, row.pickup_lng)} />
          {row.status === "paid" && profile ? (
            <Button label="Rate driver" onPress={() => router.push(`/(customer)/rate/${row.id}`)} />
          ) : null}
          {profile ? (
            <>
              <CancelBox job={row} role="customer" onDone={() => void job.refetch()} />
              <DisputeBox job={row} userId={profile.id} paidAt={paidAt} onDone={() => void job.refetch()} />
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
