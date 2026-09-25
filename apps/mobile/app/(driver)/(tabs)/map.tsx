import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Footprints, Route, Sofa, Users } from "lucide-react-native";
import {
  chicagoDate,
  drivenMiles,
  formatUsd,
  haversineMiles,
  jobA11yLabel,
  neighbourhood,
  PENSACOLA_CENTER,
  type Job,
} from "@heft/shared";
import { JobMap, type MapPin } from "../../../src/components/JobMap";
import { FloatingIllustration } from "../../../src/components/Illustration";
import { PartnerSheet } from "../../../src/components/PartnerSheet";
import { C, font, HoldToAccept, OutlineButton, PrimaryButton } from "../../../src/components/v2";
import { errorText, invoke } from "../../../src/lib/invoke";
import { haptic } from "../../../src/lib/haptics";
import { supabase } from "../../../src/lib/supabase";
import { useSession } from "../../../src/store/session";
import { toast } from "../../../src/store/toast";

export default function DriverJobs() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const today = chicagoDate();
  const partnerships = useQuery({
    queryKey: ["partnerships", profile?.id, today],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_partnerships");
      if (error) throw error;
      return (data ?? []) as PartnershipRow[];
    },
  });
  const todayRows = (partnerships.data ?? []).filter((row) => String(row.shift_date).slice(0, 10) === today);
  const minePartnership = todayRows.find((row) => row.lead_id === profile?.id && (row.status === "accepted" || row.status === "pending"));
  const asPartner = todayRows.find((row) => row.partner_id === profile?.id && row.status === "accepted");
  const partnerLabel = minePartnership?.status === "accepted"
    ? `Partner today: ${firstName(minePartnership.partner_first_name)}`
    : minePartnership?.status === "pending"
      ? `Waiting for ${firstName(minePartnership.partner_first_name)} to accept`
      : "Partner today: None";
  const jobs = useQuery({
    queryKey: ["open-jobs", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("status", "open").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
  const mine = useQuery({
    queryKey: ["driver-active", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("driver_id", profile!.id)
        .in("status", ["assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff"]);
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
  const payouts = useQuery({
    queryKey: ["today-pay", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payouts").select("amount_cents, created_at");
      if (error) throw error;
      const todayKey = chicagoDate();
      return ((data ?? []) as { amount_cents: number; created_at?: string }[])
        .filter((row) => row.created_at && chicagoDate(new Date(row.created_at)) === todayKey)
        .reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
    },
  });
  const partnerJobs = useQuery({
    queryKey: ["partner-on", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("partner_driver_id", profile!.id)
        .in("status", ["assigned", "en_route_pickup", "at_pickup", "en_route_dropoff", "at_dropoff", "delivered"]);
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
  const rows = online ? (jobs.data ?? []) : [];
  const pins: MapPin[] = rows.map((job, index) => ({
    id: job.id,
    lat: job.pickup_lat,
    lng: job.pickup_lng,
    title: "",
    kind: "payout",
    payout: formatUsd(job.lead_payout_cents ?? job.driver_payout_cents),
    hot: index === 0,
  }));
  pins.push({ id: "me", lat: PENSACOLA_CENTER.lat, lng: PENSACOLA_CENTER.lng, title: "", kind: "driver" });

  async function accept(job: Job) {
    try {
      await invoke("accept-job", { job_id: job.id });
      haptic.success();
      toast("Job accepted. Head to pickup.", "ok");
      await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
      router.push(`/job/${job.id}`);
    } catch (err) {
      haptic.warning();
      toast(errorText(err).includes("taken") ? "Another driver took this one." : errorText(err));
    }
  }

  const backingOut = (mine.data ?? []).filter((job) => job.partner_lost_at && (job.status === "assigned" || job.status === "en_route_pickup"));
  const currentJobs = (mine.data ?? []).filter((job) => !job.partner_lost_at);

  async function endDay() {
    setActionNote("");
    const { error } = await supabase.rpc("end_partnership");
    if (error) {
      setActionNote(error.message);
      return;
    }
    await queryClient.invalidateQueries();
  }

  async function releaseJob() {
    setActionNote("");
    const { data, error } = await supabase.rpc("release_partner_job");
    if (error) {
      setActionNote(error.message);
      return;
    }
    const result = data as { status?: string; message?: string } | null;
    if (result?.status === "none") {
      setActionNote(result.message || "No job to release");
      return;
    }
    await queryClient.invalidateQueries();
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ height: 280 }}>
        <JobMap pins={pins} height={280} route={false} />
        <View style={{ position: "absolute", top: 52, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ backgroundColor: C.white, borderRadius: 999, paddingLeft: 12, paddingRight: 8, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? C.green : C.steel400 }} />
            <Text style={{ fontFamily: font.semi, fontSize: 15 }}>{online ? "Online" : "Offline"}</Text>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel={online ? "You're online. Tap to go offline" : "You're offline. Tap to go online"}
              value={online}
              onValueChange={(value) => {
                setOnline(value);
                if (value) haptic.medium();
                else haptic.light();
              }}
              trackColor={{ true: C.green, false: C.sand300 }}
            />
          </View>
          {payouts.isLoading ? (
            <View style={{ width: 108, height: 44, borderRadius: 999, backgroundColor: C.sand150 }} />
          ) : (
            <View style={{ backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 14 }}>Today {formatUsd(payouts.data ?? 0)}</Text>
            </View>
          )}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        {asPartner ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={partnerLabel} onPress={() => setPartnerOpen(true)} style={{ alignSelf: "flex-start", backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 15 }}>{partnerLabel} ›</Text>
          </Pressable>
        )}
        {todayRows.filter((row) => row.partner_id === profile?.id && row.status === "pending").map((row) => (
          <Pressable key={row.id} accessibilityRole="button" onPress={() => router.push(`/invite/${row.id}`)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{firstName(row.lead_first_name)} added you as their partner today.</Text>
            <Text style={{ fontFamily: font.body, fontSize: 15, color: C.steel, marginTop: 4 }}>Your share is paid to you directly.</Text>
            <Text style={{ fontFamily: font.semi, fontSize: 15, marginTop: 8 }}>Accept or not today</Text>
          </Pressable>
        ))}
        {backingOut.map((job) => (
          <View key={job.id} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{job.item_description}</Text>
            <Text style={{ fontFamily: font.body, fontSize: 15, color: C.ink, marginTop: 4 }}>{backoutCopy(job.partner_lost_at!)}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <View style={{ flex: 1 }}><PrimaryButton label="Pick partner" onPress={() => setPartnerOpen(true)} /></View>
              <View style={{ flex: 1 }}><OutlineButton label="Release job" onPress={() => void releaseJob()} /></View>
            </View>
            {actionNote ? <Text style={{ marginTop: 10, fontFamily: font.body, fontSize: 15, color: C.ink }}>{actionNote}</Text> : null}
          </View>
        ))}
        {asPartner ? (
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 18 }}>You're partnered with {firstName(asPartner.lead_first_name)} today</Text>
            <View style={{ marginTop: 12 }}>
              <OutlineButton label="End" onPress={() => void endDay()} />
            </View>
            {actionNote ? <Text style={{ marginTop: 10, fontFamily: font.body, fontSize: 15, color: C.ink }}>{actionNote}</Text> : null}
          </View>
        ) : null}
        {asPartner ? (partnerJobs.data ?? []).map((job) => (
          <Pressable key={job.id} onPress={() => router.push(`/job/${job.id}`)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{job.item_description}</Text>
            <Text style={{ color: C.steel, marginTop: 4, fontFamily: font.body, fontSize: 14 }}>{job.pickup_address}</Text>
            <Text style={{ fontFamily: font.semi, fontSize: 16, marginTop: 8 }}>You get {formatUsd(job.helper_payout_cents ?? 0)}</Text>
          </Pressable>
        )) : null}
        {!asPartner ? currentJobs.map((job) => (
          <Pressable key={job.id} onPress={() => router.push(`/job/${job.id}`)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Current job · {job.item_description}</Text>
            <Text style={{ color: C.steel, marginTop: 4, fontFamily: font.body, fontSize: 14 }}>{job.pickup_address}</Text>
          </Pressable>
        )) : null}
        {jobs.isLoading && !asPartner ? (
          <View style={{ gap: 10 }}>
            <View style={{ width: 180, height: 28, borderRadius: 8, backgroundColor: C.sand150 }} />
            <View style={{ height: 120, borderRadius: 18, backgroundColor: C.sand150 }} />
            <View style={{ height: 120, borderRadius: 18, backgroundColor: C.sand150 }} />
          </View>
        ) : asPartner ? null : (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Text style={{ fontFamily: font.heading, fontSize: 22 }}>{rows.length === 1 ? "1 job near you" : `${rows.length} jobs near you`}</Text>
          <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14 }}>Highest pay first</Text>
        </View>
        )}
        {!online && !asPartner ? (
          <View style={{ alignItems: "flex-start", gap: 12 }}>
            <Text style={{ fontFamily: font.body, fontSize: 16, color: C.steel }}>You're offline. Go online to see jobs near you.</Text>
            <PrimaryButton label="Go online" onPress={() => setOnline(true)} />
          </View>
        ) : null}
        {online && !asPartner && jobs.isSuccess && rows.length === 0 ? (
          <View style={{ alignItems: "center", padding: 16 }}>
            <FloatingIllustration name="box-sleep" />
            <Text style={{ marginTop: 8, textAlign: "center", color: C.steel, fontFamily: font.body, fontSize: 16 }}>
              Quiet out there. We'll show new jobs here as soon as they come in.
            </Text>
          </View>
        ) : null}
        {!asPartner ? rows.map((job) => (
          <JobOffer key={job.id} job={job} partnerReady={minePartnership?.status === "accepted"} onAccept={() => accept(job)} onOpen={() => router.push(`/job/${job.id}`)} onNeedPartner={() => setPartnerOpen(true)} />
        )) : null}
      </ScrollView>
      <PartnerSheet open={partnerOpen} onClose={() => { setPartnerOpen(false); void queryClient.invalidateQueries({ queryKey: ["partnerships"] }); void queryClient.invalidateQueries({ queryKey: ["open-jobs"] }); }} />
    </View>
  );
}

type PartnershipRow = {
  id: string;
  lead_id: string;
  partner_id: string;
  status: string;
  shift_date?: string;
  lead_first_name?: string | null;
  partner_first_name?: string | null;
  phone?: string | null;
};

function firstName(name?: string | null) {
  return name?.split(" ")[0] || "your partner";
}

function backoutCopy(lostAt: string) {
  const deadline = new Date(new Date(lostAt).getTime() + 10 * 60 * 1000);
  const remaining = deadline.getTime() - Date.now();
  if (remaining < 2 * 60 * 1000) return "About 2 minutes left";
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(deadline);
  return `Pick another partner by ${clock} to keep this job.`;
}

function JobOffer({ job, partnerReady, onAccept, onOpen, onNeedPartner }: { job: Job; partnerReady: boolean; onAccept: () => void; onOpen: () => void; onNeedPartner: () => void }) {
  const keep = job.lead_payout_cents ?? job.driver_payout_cents ?? 0;
  const helper = job.helper_payout_cents ?? 0;
  const billable = job.billable_miles ?? Math.ceil(Number(job.distance_miles ?? 0));
  const out = job.pickup_in_zone === false || job.dropoff_in_zone === false;
  const driven = drivenMiles(billable, out);
  const perMile = driven > 0 ? keep / 100 / driven : 0;
  const stairs = (job.stairs_pickup_flights ?? 0) + (job.stairs_dropoff_flights ?? 0);
  const needsPartner = job.needs_second_person && !partnerReady;
  return (
    <View accessibilityLabel={jobA11yLabel(job)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12 }}>
      <Pressable onPress={onOpen}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14 }}>You keep</Text>
          <View style={{ backgroundColor: C.sand150, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 12 }}>${perMile.toFixed(2)}/mi</Text>
          </View>
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 34, color: C.ink }}>{formatUsd(keep)}</Text>
        {job.needs_second_person ? <Text style={{ fontFamily: font.body, fontSize: 15, color: C.ink }}>Second person gets {formatUsd(helper)}, paid to them directly.</Text> : null}
        <Meta icon={<Route color={C.steel} size={16} />} text={`${driven} mi driven`} />
        <Meta icon={<Sofa color={C.steel} size={16} />} text={`${job.item_description} · ${job.size_tier ?? job.size_category}`} />
        <Meta icon={<Footprints color={C.steel} size={16} />} text={stairs > 0 ? `${stairs} flights` : "No stairs"} />
        {job.needs_second_person ? <Meta icon={<Users color={C.steel} size={16} />} text="2-person job" /> : null}
        <View style={{ marginTop: 8, backgroundColor: C.paper, borderRadius: 12, padding: 10 }}>
          <Text style={{ fontFamily: font.body, fontSize: 14 }}>Pickup · {neighbourhood(job.pickup_address)}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 14 }}>Drop-off · {neighbourhood(job.dropoff_address)}</Text>
        </View>
      </Pressable>
      <View style={{ marginTop: 12 }}>
        {needsPartner ? <OutlineButton label="Add a partner first" onPress={onNeedPartner} /> : <HoldToAccept onAccept={onAccept} />}
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 }}>
      {icon}
      <Text style={{ fontFamily: font.body, fontSize: 15, color: C.ink }}>{text}</Text>
    </View>
  );
}
