import { useEffect, useState } from "react";
import { Linking, Platform, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  STATUS_LABEL,
  formatUsd,
  isActiveDelivery,
  nextDriverStatus,
  type Job,
  type JobEvent,
} from "@heft/shared";
import { CancelBox, DisputeBox } from "../../../src/components/JobActions";
import { Button, ErrorText, Notice, Screen, StatusPill } from "../../../src/components/ui";
import { errorText, invoke } from "../../../src/lib/invoke";
import { uploadJobImage } from "../../../src/lib/photos";
import { supabase } from "../../../src/lib/supabase";
import { useSession } from "../../../src/store/session";

export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [podCount, setPodCount] = useState(0);

  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (queryError) throw queryError;
      return data as Job | null;
    },
  });

  async function refreshPod() {
    const { count } = await supabase
      .from("job_photos")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id)
      .eq("kind", "pod");
    setPodCount(count ?? 0);
  }

  useEffect(() => {
    void refreshPod();
  }, [id, job.data?.status]);

  useEffect(() => {
    const channel = supabase
      .channel(`driver-job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["job", id] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    const row = job.data;
    if (!row || !profile || row.driver_id !== profile.id || !isActiveDelivery(row.status)) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function ping() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted" || !profile) return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await supabase
        .from("driver_profiles")
        .update({
          current_lat: position.coords.latitude,
          current_lng: position.coords.longitude,
          last_seen_at: new Date().toISOString(),
        })
        .eq("user_id", profile.id);
    }
    void ping();
    timer = setInterval(() => void ping(), 9000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [job.data?.status, job.data?.driver_id, profile]);

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
      .then(({ data }) => setPaidAt((data as Pick<JobEvent, "created_at"> | null)?.created_at ?? null));
  }, [id, job.data?.status]);

  const row = job.data;
  const next = row ? nextDriverStatus(row.status) : null;

  async function accept() {
    setPending(true);
    setError("");
    try {
      await invoke("accept-job", { job_id: id });
      await queryClient.invalidateQueries({ queryKey: ["job", id] });
      await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function advance(status: string) {
    setPending(true);
    setError("");
    try {
      await invoke("update-job-status", { job_id: id, status });
      await job.refetch();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function addPod() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo permission is required for proof of delivery.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets[0] || !row) return;
    try {
      await uploadJobImage("pod", row.id, result.assets[0].uri);
      await refreshPod();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function complete() {
    setPending(true);
    setError("");
    try {
      await invoke("complete-job", { job_id: id });
      await job.refetch();
      await queryClient.invalidateQueries({ queryKey: ["earnings"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  function navigate(lat: number, lng: number) {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    if (url) void Linking.openURL(url);
  }

  return (
    <Screen title="Job" back>
      {!row ? <Text className="text-sm text-steel">This job is not visible. Go online inside your service area, or it was already taken.</Text> : null}
      {row ? (
        <>
          <StatusPill status={row.status} />
          <Text className="mt-3 text-xl font-semibold text-charcoal">{row.item_description}</Text>
          <Text className="mt-2 text-sm leading-5 text-steel">
            {row.pickup_address}
            {"\n"}→ {row.dropoff_address}
          </Text>
          <Text className="mt-3 font-mono text-lg">{formatUsd(row.driver_payout_cents)} payout</Text>
          {row.stripe_payment_intent_id?.startsWith("pi_sandbox_") ? (
            <Notice>Sandbox hold. Completing the job records a pending payout.</Notice>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          {row.status === "open" ? <Button label={pending ? "Accepting" : "Accept job"} disabled={pending} onPress={accept} /> : null}
          {row.driver_id === profile?.id && row.status !== "open" ? (
            <>
              {["assigned", "en_route_pickup", "at_pickup"].includes(row.status) ? (
                <Button label="Navigate to pickup" tone="charcoal" onPress={() => navigate(row.pickup_lat, row.pickup_lng)} />
              ) : null}
              {["en_route_dropoff", "at_dropoff"].includes(row.status) ? (
                <Button label="Navigate to drop-off" tone="charcoal" onPress={() => navigate(row.dropoff_lat, row.dropoff_lng)} />
              ) : null}
              {next && next !== "delivered" ? (
                <Button label={pending ? "Updating" : `Mark ${STATUS_LABEL[next]}`} disabled={pending} onPress={() => advance(next)} />
              ) : null}
              {row.status === "at_dropoff" || row.status === "delivered" ? (
                <>
                  <Text className="mb-2 mt-4 text-sm text-steel">Proof of delivery: {podCount} photo(s). At least one is required.</Text>
                  <Button label="Upload POD photo" tone="ghost" onPress={addPod} />
                </>
              ) : null}
              {next === "delivered" ? (
                <Button
                  label={pending ? "Updating" : "Mark delivered"}
                  disabled={pending || podCount < 1}
                  onPress={() => advance("delivered")}
                />
              ) : null}
              {row.status === "delivered" ? (
                <Button label={pending ? "Completing" : "Complete and record payout"} disabled={pending || podCount < 1} onPress={complete} />
              ) : null}
              {row.status === "paid" ? (
                <Button label="Rate customer" onPress={() => router.push(`/(driver)/rate/${row.id}`)} />
              ) : null}
            </>
          ) : null}
          {profile ? (
            <>
              <CancelBox job={row} role="driver" onDone={() => void job.refetch()} />
              <DisputeBox job={row} userId={profile.id} paidAt={paidAt} onDone={() => void job.refetch()} />
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
