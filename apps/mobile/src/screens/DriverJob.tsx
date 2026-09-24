import { useEffect, useState } from "react";
import { AppState, Linking, Platform, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  STATUS_LABEL,
  formatUsd,
  isActiveDelivery,
  loadFailureCopy,
  nextDriverStatus,
  type Job,
  type JobEvent,
  type JobStatus,
} from "@heft/shared";
import { CancelBox, DisputeBox } from "../components/JobActions";
import { Button, EmptyState, ErrorText, Notice, Screen, StatusPill } from "../components/ui";
import { track } from "../lib/analytics";
import { demoMode } from "../lib/supabase";
import { errorText, invoke } from "../lib/invoke";
import { uploadJobImage } from "../lib/photos";
import { supabase } from "../lib/supabase";
import { useSession } from "../store/session";
import { toast } from "../store/toast";

const RAIL: { key: JobStatus; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "en_route_pickup", label: "To pickup" },
  { key: "at_pickup", label: "At pickup" },
  { key: "en_route_dropoff", label: "To drop-off" },
  { key: "at_dropoff", label: "At drop-off" },
  { key: "delivered", label: "Delivered" },
  { key: "paid", label: "Paid" },
];

function StatusRail({ status }: { status: JobStatus }) {
  const index = RAIL.findIndex((step) => step.key === status);
  if (index < 0) return null;
  return (
    <View className="mb-4 flex-row flex-wrap">
      {RAIL.map((step, stepIndex) => {
        const reached = stepIndex <= index;
        const current = stepIndex === index;
        return (
          <View key={step.key} className="mb-2 mr-3">
            <Text className={`text-[11px] font-semibold uppercase tracking-wider ${reached ? "text-charcoal" : "text-steel"}`}>
              {step.label}
            </Text>
            <View className={`mt-1 h-1 w-12 ${current ? "bg-amber" : reached ? "bg-charcoal" : "bg-line"}`} />
          </View>
        );
      })}
    </View>
  );
}

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
    if (Platform.OS === "web" || !row || !profile || row.driver_id !== profile.id || !isActiveDelivery(row.status)) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function ping() {
      if (AppState.currentState !== "active") return;
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

  function fail(err: unknown) {
    const message = errorText(err);
    setError(message);
    toast(message);
  }

  async function accept() {
    setPending(true);
    setError("");
    try {
      await invoke("accept-job", { job_id: id });
      await queryClient.invalidateQueries({ queryKey: ["job", id] });
      await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
      track({ name: "job_accepted" });
      toast("Job accepted. Head to pickup.", "ok");
    } catch (err) {
      fail(err);
    } finally {
      setPending(false);
    }
  }

  async function advance(status: JobStatus) {
    setPending(true);
    setError("");
    try {
      await invoke("update-job-status", { job_id: id, status });
      await job.refetch();
      toast(`Marked ${STATUS_LABEL[status]}.`, "ok");
    } catch (err) {
      fail(err);
    } finally {
      setPending(false);
    }
  }

  async function addPod(source: "camera" | "library") {
    setError("");
    if (!row) return;
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const message =
        source === "camera"
          ? "Camera permission is required to photograph the delivery."
          : "Photo library permission is required for proof of delivery.";
      setError(message);
      toast(message);
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    try {
      await uploadJobImage("pod", row.id, result.assets[0].uri);
      track({ name: "pod_uploaded" });
      await refreshPod();
      toast("Proof photo saved.", "ok");
    } catch (err) {
      fail(err);
    }
  }

  async function complete() {
    setPending(true);
    setError("");
    try {
      await invoke("complete-job", { job_id: id });
      await job.refetch();
      await queryClient.invalidateQueries({ queryKey: ["earnings"] });
      toast("Payout recorded. Check Earnings.", "ok");
    } catch (err) {
      fail(err);
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
      {job.isLoading ? <EmptyState title="Loading job" body="Fetching the latest status." /> : null}
      {job.isError ? (
        <EmptyState title={loadFailureCopy((job.error as Error).message).title} body={loadFailureCopy((job.error as Error).message).body} />
      ) : null}
      {!job.isLoading && !job.isError && !row ? (
        <EmptyState
          title="Job not visible"
          body="Go online inside your service area with an approved vehicle, or this job was already taken."
        />
      ) : null}
      {row ? (
        <>
          <StatusPill status={row.status} />
          <View className="mt-3">
            <StatusRail status={row.status} />
          </View>
          <Text className="text-xl font-semibold text-charcoal">{row.item_description}</Text>
          <Text className="mt-2 text-sm leading-5 text-steel">
            {row.pickup_address}
            {"\n"}→ {row.dropoff_address}
          </Text>
          <Text className="mt-3 font-mono text-lg">{formatUsd(row.driver_payout_cents)} payout</Text>
          {row.driver_id === profile?.id && isActiveDelivery(row.status) ? (
            <Text className="mt-2 text-sm leading-5 text-steel">
              Location updates about every 10 seconds while this delivery is active and the app is open. Faster updates are ignored.
            </Text>
          ) : null}
          {row.stripe_payment_intent_id?.startsWith("pi_sandbox_") ? (
            <Notice>Sandbox hold. Completing the job records a pending payout. No card is charged.</Notice>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          {row.status === "open" ? <Button label={pending ? "Accepting" : "Accept job"} disabled={pending} onPress={() => void accept()} /> : null}
          {row.driver_id === profile?.id && row.status !== "open" ? (
            <>
              {["assigned", "en_route_pickup", "at_pickup"].includes(row.status) ? (
                <Button label="Navigate to pickup" tone="charcoal" onPress={() => navigate(row.pickup_lat, row.pickup_lng)} />
              ) : null}
              {["en_route_dropoff", "at_dropoff"].includes(row.status) ? (
                <Button label="Navigate to drop-off" tone="charcoal" onPress={() => navigate(row.dropoff_lat, row.dropoff_lng)} />
              ) : null}
              {next && next !== "delivered" ? (
                <Button label={pending ? "Updating" : `Mark ${STATUS_LABEL[next]}`} disabled={pending} onPress={() => void advance(next)} />
              ) : null}
              {row.status === "at_dropoff" || row.status === "delivered" ? (
                <>
                  <Text className="mb-2 mt-2 text-sm font-semibold text-charcoal">Proof of delivery</Text>
                  {podCount < 1 ? (
                    <Notice>Add a photo of the load at the drop-off. Mark delivered stays locked until one photo is saved.</Notice>
                  ) : (
                    <Text className="mb-3 text-sm text-steel">
                      {podCount} photo{podCount === 1 ? "" : "s"} attached.
                    </Text>
                  )}
                  {demoMode ? (
                    <Button
                      label="Use sample delivery photo"
                      onPress={() => {
                        void (async () => {
                          const { error: insertError } = await supabase.from("job_photos").insert({
                            job_id: row.id,
                            storage_path: `${row.id}/demo-pod.svg`,
                            kind: "pod",
                          });
                          if (insertError) {
                            fail(new Error(insertError.message));
                            return;
                          }
                          track({ name: "pod_uploaded" });
                          await refreshPod();
                          toast("Sample proof photo saved.", "ok");
                        })();
                      }}
                    />
                  ) : null}
                  <Button label="Take photo" onPress={() => void addPod("camera")} />
                  <Button label="Choose from library" tone="ghost" onPress={() => void addPod("library")} />
                </>
              ) : null}
              {next === "delivered" ? (
                <Button
                  label={podCount < 1 ? "Photo required to mark delivered" : pending ? "Updating" : "Mark delivered"}
                  disabled={pending || podCount < 1}
                  onPress={() => void advance("delivered")}
                />
              ) : null}
              {row.status === "delivered" ? (
                <Button
                  label={podCount < 1 ? "Photo required to complete" : pending ? "Completing" : "Complete and record payout"}
                  disabled={pending || podCount < 1}
                  onPress={() => void complete()}
                />
              ) : null}
              {row.status === "paid" ? (
                <Button label="Rate customer" onPress={() => router.push(`/rate/${row.id}`)} />
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
