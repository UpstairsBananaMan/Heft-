import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, BadgeCheck, Check, MessageCircle, Phone } from "lucide-react-native";
import {
  CUSTOMER_STATUS,
  approvedByLabel,
  driverRatingLabel,
  formatUsd,
  haversineMiles,
  showStarRating,
  type Job,
  type JobStatus,
} from "@heft/shared";
import { JobMap } from "../components/JobMap";
import { Confetti, PulseRing, SkipLayer, useDelight } from "../components/delight";
import { LookingIllustration, WavingIllustration, Illustration } from "../components/Illustration";
import { C, font, PrimaryButton } from "../components/v2";
import { haptic } from "../lib/haptics";
import { invoke } from "../lib/invoke";
import { demoMode, supabase } from "../lib/supabase";
import type { IllustrationName } from "../illustrations/markup";

type Card = {
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  vehicle_color: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  plate: string | null;
  status: string;
  approved_documents: boolean;
};

const STEPS = ["Finding your driver", "Driver on the way", "Picked up", "Delivered"];

function stepIndex(status: JobStatus): number {
  if (status === "open" || status === "priced" || status === "draft") return 0;
  if (status === "assigned" || status === "en_route_pickup" || status === "at_pickup") return 1;
  if (status === "en_route_dropoff" || status === "at_dropoff") return 2;
  if (status === "delivered" || status === "paid") return 3;
  return 0;
}

export default function CustomerJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Job | null;
    },
  });
  const card = useQuery({
    queryKey: ["driver-card", id],
    enabled: Boolean(job.data?.driver_id),
    queryFn: () => invoke<Card | null>("assigned_driver_card", { job_id: id }),
  });
  const row = job.data;
  const index = row ? stepIndex(row.status) : 0;
  const done = row?.status === "delivered" || row?.status === "paid";
  const person = card.data;
  const first = person?.display_name?.split(" ")[0] ?? "your driver";
  const match = useDelight({
    jobId: row?.id,
    moment: "driver-found",
    announce: `${first} is on it`,
    enabled: Boolean(row && person && !done && index >= 1),
  });
  const picked = useDelight({
    jobId: row?.id,
    moment: "picked-up",
    announce: "Picked up",
    enabled: Boolean(row && index === 2),
  });
  const delivered = useDelight({
    jobId: row?.id,
    moment: "delivered",
    announce: "Delivered",
    enabled: Boolean(row && done),
  });
  const [shout, setShout] = useState(false);
  const [rateOn, setRateOn] = useState(false);
  const [hideParty, setHideParty] = useState(false);
  useEffect(() => {
    if (!match.playing) return;
    setShout(true);
    haptic.success();
    const timer = setTimeout(() => setShout(false), 2000);
    return () => clearTimeout(timer);
  }, [match.playing]);
  useEffect(() => {
    if (!picked.playing) return;
    haptic.light();
  }, [picked.playing]);
  useEffect(() => {
    if (!delivered.playing && !delivered.settled) return;
    if (delivered.playing) haptic.success();
    if (delivered.reduced || delivered.settled) {
      setRateOn(true);
      return;
    }
    const timer = setTimeout(() => setRateOn(true), 800);
    return () => clearTimeout(timer);
  }, [delivered.playing, delivered.settled, delivered.reduced]);
  if (!row) {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.body, fontSize: 16 }}>{job.isLoading ? " " : "Job not found"}</Text>
      </View>
    );
  }
  const pins = [
    { id: "pickup", lat: row.pickup_lat, lng: row.pickup_lng, title: "Pickup", kind: "pickup" as const },
    { id: "dropoff", lat: row.dropoff_lat, lng: row.dropoff_lng, title: "Drop-off", kind: "dropoff" as const },
    ...(index >= 1
      ? [{ id: "driver", lat: row.pickup_lat + 0.01, lng: row.pickup_lng - 0.01, title: "", kind: "driver" as const }]
      : []),
  ];
  const minutes = Math.max(8, Math.round(haversineMiles(row.pickup_lat, row.pickup_lng, row.dropoff_lat, row.dropoff_lng) * 2.4));
  const headline = shout ? `${first} is on it!` : CUSTOMER_STATUS[row.status];
  const phone = person?.phone ? (person.phone.startsWith("+") ? person.phone : `+1${person.phone}`) : null;
  const vehicle = [person?.vehicle_color, person?.vehicle_make, person?.vehicle_model].filter(Boolean).join(" ");

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flex: 1 }}>
        <JobMap pins={pins} />
        <View style={{ position: "absolute", top: 52, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={round}>
            <ArrowLeft color={C.ink} size={20} />
          </Pressable>
          <View style={{ backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber }} />
            <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 14 }}>{index === 0 ? "Finding a driver" : `Pickup in ${minutes} min`}</Text>
          </View>
          <Pressable onPress={() => setHelp(true)} style={round}>
            <Text style={{ fontFamily: font.semi, fontSize: 14 }}>Help</Text>
          </Pressable>
        </View>
        {index === 0 ? (
          <View pointerEvents="none" style={{ position: "absolute", top: "46%", left: "46%" }}>
            <PulseRing />
          </View>
        ) : null}
        {picked.playing ? <View pointerEvents="none" accessible={false} style={{ position: "absolute", top: "44%", left: "42%", width: 18, height: 18, borderRadius: 4, backgroundColor: C.ink, transform: [{ translateX: 4 }] }} /> : null}
      </View>
      <View pointerEvents={match.locked && match.playing ? "none" : "auto"} style={{ backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "62%" }}>
        <ScrollView>
          {index === 0 ? <LookingIllustration /> : null}
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.heading, fontSize: 26, color: C.ink }}>{headline}</Text>
          <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 16, marginTop: 4 }}>
            {index === 0 ? row.pickup_address.split(",")[0] : `About ${minutes} min to pickup · ${row.pickup_address.split(",")[0]}`}
          </Text>
          <View accessibilityLabel={`Step ${index + 1} of 4, ${STEPS[index]}, current`} style={{ flexDirection: "row", marginTop: 16, justifyContent: "space-between" }}>
            {STEPS.map((label, step) => (
              <View key={label} style={{ alignItems: "center", width: "24%" }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: step < index ? C.ink : step === index ? C.amber : C.white,
                    borderWidth: step === index ? 2 : step > index ? 2 : 0,
                    borderColor: step === index ? C.ink : C.sand300,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {step < index ? <Check color={C.paper} size={14} /> : step === index ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.ink }} /> : null}
                </View>
                <Text style={{ marginTop: 6, textAlign: "center", fontFamily: font.medium, fontSize: 12, color: C.ink }}>{label}</Text>
              </View>
            ))}
          </View>
          {person ? (
            <View style={{ marginTop: 16, backgroundColor: C.paper, borderRadius: 18, padding: 14 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.sand150, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.semi, fontSize: 18 }}>{person.display_name.slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontFamily: font.semi, fontSize: 17 }}>{person.display_name}</Text>
                    <View style={{ backgroundColor: C.sand150, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: font.medium, fontSize: 12, color: C.steel }}>
                        {showStarRating(Number(person.rating_count)) ? `★ ${driverRatingLabel(Number(person.rating_count), person.rating_avg)}` : driverRatingLabel(Number(person.rating_count), person.rating_avg)}
                      </Text>
                    </View>
                  </View>
                  {person.approved_documents ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <BadgeCheck color={C.green} size={15} />
                      <Text style={{ color: C.green, fontFamily: font.semi, fontSize: 14 }}>{approvedByLabel()}</Text>
                    </View>
                  ) : null}
                  <Text style={{ marginTop: 4, fontFamily: font.body, fontSize: 14 }}>{vehicle}</Text>
                  {person.plate ? (
                    <Text style={{ marginTop: 4, alignSelf: "flex-start", borderWidth: 1.5, borderColor: C.sand600, borderRadius: 6, paddingHorizontal: 6, fontFamily: font.medium, fontSize: 12 }}>
                      {person.plate}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable
                  accessibilityLabel={`Text ${first}`}
                  onPress={() => phone && void Linking.openURL(`sms:${phone}`)}
                  style={{ flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  <MessageCircle color={C.paper} size={18} />
                  <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 16 }}>Text {first}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Call ${first}`}
                  onPress={() => phone && void Linking.openURL(`tel:${phone}`)}
                  style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: C.sand600, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  <Phone color={C.ink} size={18} />
                  <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Call {first}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <Text style={{ marginTop: 14, fontFamily: font.body, fontSize: 16 }}>
            {row.item_description} · {formatUsd(row.final_cents ?? row.estimate_cents)}
          </Text>
          {done ? (
            <View style={{ marginTop: 12 }}>
              <PrimaryButton label="Rate your driver" onPress={() => router.push(`/rate/${row.id}`)} />
            </View>
          ) : null}
          {row.status === "cancelled" ? <Text style={{ marginTop: 8, fontFamily: font.body, fontSize: 16 }}>You weren't charged.</Text> : null}
          {row.status === "disputed" ? <Text style={{ marginTop: 8, fontFamily: font.body, fontSize: 16 }}>We're looking into it.</Text> : null}
          <SkipLayer active={match.playing || picked.playing} onSkip={() => { match.skip(); picked.skip(); }} />
          <Pressable onPress={() => setHelp((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ textDecorationLine: "underline", fontFamily: font.semi, fontSize: 16 }}>Help</Text>
          </Pressable>
          {help ? (
            <View style={{ backgroundColor: C.paper, borderRadius: 14, padding: 12 }}>
              <Text style={{ fontFamily: font.body, fontSize: 16 }}>Report a problem</Text>
              <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14, marginTop: 4 }}>Tell us what happened.</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
      {done && !hideParty ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.paper, zIndex: 5 }}>
          <Confetti count={40} play={delivered.playing && !delivered.reduced} />
          <View style={{ flex: 1, alignItems: "center", paddingTop: 88, paddingHorizontal: 24, zIndex: 2 }}>
            <WavingIllustration play={delivered.playing && !delivered.reduced} />
            <Text style={{ marginTop: 12, fontFamily: font.heading, fontSize: 32, color: C.ink }}>Delivered</Text>
            <Text style={{ marginTop: 6, textAlign: "center", fontFamily: font.body, fontSize: 16, color: C.steel }}>
              Your {row.size_category === "xl" ? "extra large" : row.size_category} {row.item_description.toLowerCase()} arrived at{" "}
              {row.delivered_at
                ? new Date(row.delivered_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : "just now"}
              .
            </Text>
            <View style={{ marginTop: 16, backgroundColor: C.white, borderRadius: 16, padding: 10, transform: [{ rotate: "-2deg" }] }}>
              {demoMode ? <Illustration name={deliveryArt(row.item_description)} width={220} height={140} /> : <View style={{ width: 220, height: 140, backgroundColor: C.sand150 }} />}
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: C.steel }}>Delivery photo · by {first}</Text>
            </View>
          </View>
          {rateOn ? (
            <View pointerEvents={delivered.locked ? "none" : "auto"} style={{ backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, zIndex: 3 }}>
              <Text style={{ fontFamily: font.heading, fontSize: 20 }}>How was {first}?</Text>
              <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14, marginBottom: 12 }}>Your rating helps other customers.</Text>
              <PrimaryButton label="Rate your driver" onPress={() => router.push(`/rate/${row.id}`)} />
              <Pressable onPress={() => setHideParty(true)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Not now</Text>
              </Pressable>
            </View>
          ) : null}
          <SkipLayer active={delivered.playing} onSkip={delivered.skip} />
        </View>
      ) : null}
    </View>
  );
}

function deliveryArt(item: string): IllustrationName {
  const value = item.toLowerCase();
  if (value.includes("fridge") || value.includes("appliance")) return "photo-fridge-after";
  if (value.includes("mattress")) return "photo-mattress-after";
  return "photo-couch-after";
}

const round = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: C.white,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
