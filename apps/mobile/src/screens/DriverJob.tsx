import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Clock, MessageCircle, Phone, Star } from "lucide-react-native";
import {
  DRIVER_ACTION,
  formatUsd,
  haversineMiles,
  neighbourhood,
  nextDriverStatus,
  payoutAnnounce,
  payoutCaption,
  payoutPhase,
  type Job,
  type JobStatus,
} from "@heft/shared";
import { JobMap } from "../components/JobMap";
import { Confetti, CountUp, SkipLayer, useDelight } from "../components/delight";
import { Illustration } from "../components/Illustration";
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
        if (demoMode) {
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
    return <PayoutMoment cents={donePay} jobId={current.id} item={current.item_description} route={`${neighbourhood(current.pickup_address)} → ${neighbourhood(current.dropoff_address)}`} miles={Number(current.distance_miles ?? 0)} onDone={() => router.replace("/(driver)/map")} />;
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

function PayoutMoment({
  cents,
  jobId,
  item,
  route,
  miles,
  onDone,
}: {
  cents: number;
  jobId: string;
  item: string;
  route: string;
  miles: number;
  onDone: () => void;
}) {
  const profile = useSession((state) => state.profile);
  const setup = useQuery({
    queryKey: ["payout-setup", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("stripe_connect_account_id").eq("user_id", profile!.id).maybeSingle();
      if (error) throw error;
      return Boolean((data as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id);
    },
  });
  const payouts = useQuery({
    queryKey: ["payout-status", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payouts").select("amount_cents,status,job_id");
      if (error) throw error;
      return (data ?? []) as { amount_cents: number; status: string; job_id: string }[];
    },
  });
  const mine = (payouts.data ?? []).find((row) => row.job_id === jobId);
  const phase = payoutPhase({ setupComplete: Boolean(setup.data), status: mine?.status });
  const caption = payoutCaption(phase);
  const today = (payouts.data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0) || cents;
  const delight = useDelight({
    jobId,
    moment: "payout",
    announce: payoutAnnounce(formatUsd(cents), phase),
    enabled: setup.isSuccess && payouts.isSuccess,
  });
  const [score, setScore] = useState(0);
  const [rated, setRated] = useState(false);
  async function rateCustomer(value: number) {
    if (rated || !profile) return;
    setScore(value);
    const { data } = await supabase.from("jobs").select("customer_id").eq("id", jobId).maybeSingle();
    const customerId = (data as { customer_id?: string } | null)?.customer_id;
    if (!customerId) return;
    const { error } = await supabase.from("ratings").insert({
      job_id: jobId,
      from_user_id: profile.id,
      to_user_id: customerId,
      stars: value,
    });
    if (!error) setRated(true);
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.ink }}>
      <Confetti count={20} play={delight.playing && !delight.reduced} />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 88, zIndex: 2 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: C.amber50, alignItems: "center", justifyContent: "center" }}>
          <Illustration name="box-happy" width={84} height={84} />
        </View>
        <Text style={{ marginTop: 16, color: "#C8C2B8", fontFamily: font.medium, fontSize: 14 }}>Delivery complete</Text>
        <CountUp cents={cents} play={delight.playing && !delight.reduced} prefix="+" color={C.paper} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          {phase === "paid" ? <Check color="#F2C45A" size={16} /> : <Clock color="#F2C45A" size={16} />}
          <Text style={{ color: "#F2C45A", fontFamily: font.semi, fontSize: 16 }}>{caption}</Text>
        </View>
        <View style={{ marginTop: 12, backgroundColor: "#24282D", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 14 }}>Today </Text>
          <CountUp cents={today} play={delight.playing && !delight.reduced} color={C.paper} size={16} hapticOnEnd={false} />
        </View>
        <View style={{ marginTop: 28, alignSelf: "stretch", marginHorizontal: 20, backgroundColor: "#24282D", borderRadius: 16, padding: 14 }}>
          <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 16 }}>{item}</Text>
          <Text style={{ color: "#C8C2B8", fontFamily: font.body, fontSize: 14 }}>{route} · {miles.toFixed(1)} mi</Text>
          <Text style={{ marginTop: 8, color: "#C8C2B8", fontFamily: font.body, fontSize: 14 }}>Delivery photo saved</Text>
        </View>
      </View>
      <View pointerEvents={delight.locked ? "none" : "auto"} style={{ padding: 20, zIndex: 3 }}>
        <PrimaryButton label="Back to jobs" onPress={onDone} />
        <View style={{ minHeight: 48, marginTop: 8, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 16, marginBottom: 4 }}>{rated ? "Thanks" : "Rate the customer"}</Text>
          <View style={{ flexDirection: "row" }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityLabel={`${value} star${value === 1 ? "" : "s"} for the customer`}
                disabled={rated}
                onPress={() => void rateCustomer(value)}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Star color="#F2C45A" fill={value <= score ? "#F2C45A" : "transparent"} size={26} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <SkipLayer active={delight.playing} onSkip={delight.skip} onDark />
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
