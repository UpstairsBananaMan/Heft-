import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react-native";
import {
  DRIVER_ACTION,
  formatUsd,
  haversineMiles,
  neighbourhood,
  nextDriverStatus,
  type Job,
  type JobStatus,
} from "@heft/shared";
import { JobMap } from "../components/JobMap";
import { CelebrationSlot } from "../components/slots";
import { C, font, HoldToAccept, OutlineButton, PrimaryButton } from "../components/v2";
import { demoMode, supabase } from "../lib/supabase";
import { errorText, invoke } from "../lib/invoke";
import { haptic } from "../lib/haptics";
import { useSession } from "../store/session";

const STEP_COPY: Partial<Record<JobStatus, { n: number; headline: string }>> = {
  assigned: { n: 1, headline: "Head to pickup" },
  en_route_pickup: { n: 2, headline: "Drive to pickup" },
  at_pickup: { n: 3, headline: "Load the item" },
  en_route_dropoff: { n: 4, headline: "Drive to drop-off" },
  at_dropoff: { n: 5, headline: "Deliver and take a photo" },
};

export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [donePay, setDonePay] = useState<number | null>(null);
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (queryError) throw queryError;
      return data as Job | null;
    },
  });
  const row = job.data;
  if (!row) {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontFamily: font.body, fontSize: 16 }}>{job.isLoading ? " " : "Job not found"}</Text>
      </View>
    );
  }

  async function accept(jobId: string) {
    setError("");
    try {
      await invoke("accept-job", { job_id: jobId });
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: ["job", id] });
    } catch (err) {
      setError(errorText(err).includes("taken") ? "Another driver took this job." : errorText(err));
    }
  }

  if (row.status === "open") {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, padding: 20, paddingTop: 64 }}>
        <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center" }}>
          <ArrowLeft color={C.ink} size={22} />
        </Pressable>
        <Text style={{ fontFamily: font.display, fontSize: 40 }}>{formatUsd(row.driver_payout_cents)}</Text>
        <Text style={{ fontFamily: font.body, fontSize: 16, marginVertical: 8 }}>
          {row.item_description} · {neighbourhood(row.pickup_address)} to {neighbourhood(row.dropoff_address)}
        </Text>
        <HoldToAccept onAccept={() => accept(row.id)} />
        {error ? <Text style={{ color: C.red, marginTop: 8 }}>{error}</Text> : null}
      </View>
    );
  }

  const step = STEP_COPY[row.status];
  const goingToPickup = ["assigned", "en_route_pickup", "at_pickup"].includes(row.status);
  const address = goingToPickup ? row.pickup_address : row.dropoff_address;
  const miles = Number(row.distance_miles ?? 0);
  const minutes = Math.max(1, Math.round((miles / 22) * 60));
  const stairs = row.stairs_pickup_flights > 0 ? `${row.stairs_pickup_flights} flight at pickup` : "No stairs";
  const helper = row.needs_helper ? "Needs a second person" : "Customer will help";
  const next = nextDriverStatus(row.status);
  const action = next === "delivered" ? "Finish delivery" : next ? DRIVER_ACTION[next] ?? "Continue" : "Back to jobs";
  const needsPhoto = row.status === "at_dropoff" && !photo;
  const current = row;

  async function advance() {
    if (!next) {
      router.replace("/(driver)/map");
      return;
    }
    if (needsPhoto) return;
    setPending(true);
    setError("");
    try {
      haptic.medium();
      if (next === "delivered") {
        if (demoMode && !photo) {
          await supabase.from("job_photos").insert({ job_id: current.id, storage_path: `${current.id}/pod.jpg`, kind: "pod" });
        }
        await invoke("update-job-status", { job_id: current.id, status: "delivered" });
        await invoke("complete-job", { job_id: current.id });
        haptic.success();
        setDonePay(current.driver_payout_cents);
      } else {
        await invoke("update-job-status", { job_id: current.id, status: next });
      }
      await queryClient.invalidateQueries({ queryKey: ["job", id] });
    } catch (err) {
      haptic.error();
      setError("Didn't save. Check your connection and tap again.");
    } finally {
      setPending(false);
    }
  }

  function openMaps() {
    const lat = goingToPickup ? row!.pickup_lat : row!.dropoff_lat;
    const lng = goingToPickup ? row!.pickup_lng : row!.dropoff_lng;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    if (url) void Linking.openURL(url);
  }

  if (donePay != null) {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, padding: 24, justifyContent: "center" }}>
        <CelebrationSlot moment="delivered" />
        <Text style={{ fontFamily: font.heading, fontSize: 28 }}>Delivery complete</Text>
        <Text style={{ fontFamily: font.display, fontSize: 44, marginVertical: 8 }}>{formatUsd(donePay)}</Text>
        <Text style={{ fontFamily: font.body, fontSize: 16, color: C.steel, marginBottom: 16 }}>Set up payouts to get paid</Text>
        <PrimaryButton label="Back to jobs" onPress={() => router.replace("/(driver)/map")} />
      </View>
    );
  }

  const pins = [
    { id: "stop", lat: goingToPickup ? row.pickup_lat : row.dropoff_lat, lng: goingToPickup ? row.pickup_lng : row.dropoff_lng, title: goingToPickup ? "Pickup" : "Drop-off", kind: (goingToPickup ? "pickup" : "dropoff") as "pickup" | "dropoff" },
    { id: "driver", lat: 30.4213, lng: -87.2169, title: "", kind: "driver" as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ height: 260 }}>
        <JobMap pins={pins} height={260} />
        <View style={{ position: "absolute", top: 52, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={round}>
            <ArrowLeft color={C.ink} size={18} />
          </Pressable>
          <View style={{ backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semi }}>Payout {formatUsd(row.driver_payout_cents)}</Text>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: C.amberInk, fontFamily: font.semi, fontSize: 14 }}>
            Step {step?.n ?? 1} of 5 · {step?.headline ?? "Job"}
          </Text>
          <Text style={{ textDecorationLine: "underline", fontFamily: font.semi }}>Help</Text>
        </View>
        <Text style={{ fontFamily: font.heading, fontSize: 26, marginTop: 8 }}>{address.split(",")[0]}</Text>
        <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 16 }}>
          {neighbourhood(address)} · {miles.toFixed(1)} mi · about {minutes} min
        </Text>
        <View style={{ marginTop: 12, backgroundColor: C.amber50, borderRadius: 14, padding: 12 }}>
          <Text style={{ fontFamily: font.body, fontSize: 15 }}>
            {row.item_description} · {stairs} · {helper}
            {row.pickup_notes ? `. ${row.pickup_notes}.` : ""}
          </Text>
        </View>
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sand150, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semi }}>D</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Dana R.</Text>
            <Text style={{ color: C.steel, fontSize: 14, fontFamily: font.body }}>Customer</Text>
          </View>
          <Pressable accessibilityLabel="Text Dana" onPress={() => void Linking.openURL("sms:+18505550101")} style={round}>
            <MessageCircle color={C.ink} size={18} />
          </Pressable>
          <Pressable accessibilityLabel="Call Dana" onPress={() => void Linking.openURL("tel:+18505550101")} style={round}>
            <Phone color={C.ink} size={18} />
          </Pressable>
        </View>
        <Text style={{ marginTop: 8, color: C.steel, fontFamily: font.body, fontSize: 13 }}>Sharing your location with the customer during this job</Text>
        {row.status === "at_dropoff" ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: font.body, fontSize: 15, marginBottom: 8 }}>Take a photo of the item where you left it. The customer sees this photo.</Text>
            {demoMode ? (
              <Pressable onPress={() => setPhoto(true)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ textDecorationLine: "underline", fontFamily: font.semi }}>Demo: use a sample photo</Text>
              </Pressable>
            ) : null}
            <OutlineButton label={photo ? "Photo added" : "Choose from library"} onPress={() => setPhoto(true)} />
          </View>
        ) : null}
        {error ? <Text style={{ color: C.red, marginTop: 8, fontFamily: font.body }}>{error}</Text> : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <OutlineButton label="Open in Maps" onPress={openMaps} />
          </View>
          <View style={{ flex: 1.4 }}>
            <PrimaryButton
              label={pending ? "Finishing…" : needsPhoto ? "Add a photo to finish" : action}
              disabled={pending || needsPhoto || !profile}
              onPress={() => void advance()}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const round = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: C.white,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
