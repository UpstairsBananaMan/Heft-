import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Camera, Check, Clock, IdCard, Landmark, ShieldCheck, Truck } from "lucide-react-native";
import { APP_NAME, driverKeepPercent, type DriverProfile } from "@heft/shared";
import { C, font, PrimaryButton, Wordmark } from "../../src/components/v2";
import { demoMode, supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

const STEPS = [
  { id: "vehicle", title: "Your vehicle", body: "Type, plate, and color", icon: Truck },
  { id: "vehicle_photo", title: "Vehicle photo", body: "One photo, plate visible", icon: Camera },
  { id: "license", title: "Driver's license", body: "Front of your license", icon: IdCard },
  { id: "insurance", title: "Insurance", body: "We'll review the card", icon: ShieldCheck },
  { id: "payouts", title: "Payouts", body: "Connect your bank", icon: Landmark },
  { id: "area", title: "Where you'll drive", body: "A ZIP in Pensacola", icon: Truck },
] as const;

type Doc = { kind: string; status: string; note: string | null };

export default function DriverSetup() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<string | null>(null);
  const driver = useQuery({
    queryKey: ["driver-profile", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*").eq("user_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data as DriverProfile | null;
    },
  });
  const docs = useQuery({
    queryKey: ["driver-docs", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("*").eq("driver_id", profile!.id);
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });
  const row = driver.data;
  const documents = docs.data ?? [];
  function docStatus(kind: string) {
    return documents.find((item) => item.kind === kind)?.status;
  }
  const done = {
    vehicle: Boolean(row?.vehicle_make && row?.plate),
    vehicle_photo: docStatus("vehicle_photo") === "approved" || docStatus("vehicle_photo") === "in_review",
    license: docStatus("license") === "approved" || docStatus("license") === "in_review",
    insurance: docStatus("insurance") === "approved" || docStatus("insurance") === "in_review",
    payouts: Boolean(row?.stripe_connect_account_id),
    area: Boolean(row?.service_zip),
  };
  const count = Object.values(done).filter(Boolean).length;
  const readyToSubmit = done.vehicle && done.vehicle_photo && done.license && done.insurance && done.area;
  const next = STEPS.find((step) => !done[step.id]);
  const approved = row?.status === "approved";

  async function saveVehicle(fields: { make: string; model: string; color: string; plate: string }) {
    if (!profile) return;
    await supabase.from("driver_profiles").update({
      vehicle_make: fields.make,
      vehicle_model: fields.model,
      vehicle_color: fields.color,
      plate: fields.plate,
      vehicle_type: row?.vehicle_type ?? "pickup",
    }).eq("user_id", profile.id);
    await queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
    setPanel(null);
  }

  async function markDoc(kind: string) {
    if (!profile) return;
    await supabase.from("driver_documents").insert({
      driver_id: profile.id,
      kind,
      storage_path: `${profile.id}/${kind}.jpg`,
      status: "in_review",
    });
    await queryClient.invalidateQueries({ queryKey: ["driver-docs"] });
    setPanel(null);
  }

  async function saveZip(zip: string) {
    if (!profile) return;
    await supabase.from("driver_profiles").update({ service_zip: zip, service_lat: 30.4213, service_lng: -87.2169 }).eq("user_id", profile.id);
    await queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
    setPanel(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ backgroundColor: C.ink, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 36 }}>
        <Wordmark size={22} />
        <Text style={{ marginTop: 18, color: C.paper, fontFamily: font.heading, fontSize: 28 }}>Get approved to drive</Text>
        <Text style={{ marginTop: 6, color: "#C8C2B8", fontFamily: font.body, fontSize: 16 }}>Finish these steps to get approved.</Text>
      </View>
      <View style={{ marginTop: -20, marginHorizontal: 16, backgroundColor: C.white, borderRadius: 18, padding: 16 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 17 }}>{approved ? `Approved, you can go online` : "Not submitted yet"}</Text>
        <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14, marginTop: 2 }}>{count} of 6 done</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
          {STEPS.map((step, index) => (
            <View key={step.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index < count ? C.green : C.sand200 }} />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {STEPS.map((step) => {
          const state = done[step.id] ? (docStatus(step.id) === "in_review" ? "In review" : "Done") : "Needed";
          const Icon = step.icon;
          return (
            <Pressable key={step.id} accessibilityLabel={`${step.title}, ${state.toLowerCase()}`} onPress={() => setPanel(step.id)} style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.sand150, alignItems: "center", justifyContent: "center" }}>
                <Icon color={C.ink} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.semi, fontSize: 16 }}>{step.title}</Text>
                <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14 }}>{step.body}</Text>
              </View>
              <StatusPill label={state} />
            </Pressable>
          );
        })}
        <View style={{ marginTop: 8, backgroundColor: C.paper, borderRadius: 18, padding: 4 }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16, marginBottom: 6 }}>Why drive with {APP_NAME}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 15, color: C.steel }}>See your pay before you accept</Text>
          <Text style={{ fontFamily: font.body, fontSize: 15, color: C.steel }}>Keep {driverKeepPercent()}% of every fare</Text>
          <Text style={{ fontFamily: font.body, fontSize: 15, color: C.steel }}>A local team you can call</Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={readyToSubmit && !approved ? "Submit for review" : next ? `Add ${next.title.toLowerCase()}` : "View jobs"}
            onPress={() => {
              if (approved || readyToSubmit) router.replace("/(driver)/map");
              else if (next) setPanel(next.id);
            }}
          />
        </View>
        {panel ? (
          <Panel
            id={panel}
            onClose={() => setPanel(null)}
            onVehicle={(fields) => void saveVehicle(fields)}
            onDoc={(kind) => void markDoc(kind)}
            onZip={(zip) => void saveZip(zip)}
            onPayouts={() => router.push("/stripe/connect")}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone = label === "Done" ? { bg: C.green50, fg: C.green } : label === "In review" ? { bg: C.blue50, fg: C.blue } : { bg: C.amber50, fg: C.amberInk };
  const Icon = label === "Done" ? Check : label === "In review" ? Clock : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 10, minHeight: 28 }}>
      {Icon ? <Icon color={tone.fg} size={14} /> : <Text style={{ color: tone.fg }}>+</Text>}
      <Text style={{ color: tone.fg, fontFamily: font.semi, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Panel({
  id,
  onClose,
  onVehicle,
  onDoc,
  onZip,
  onPayouts,
}: {
  id: string;
  onClose: () => void;
  onVehicle: (fields: { make: string; model: string; color: string; plate: string }) => void;
  onDoc: (kind: string) => void;
  onZip: (zip: string) => void;
  onPayouts: () => void;
}) {
  const [make, setMake] = useState("Ford");
  const [model, setModel] = useState("F-150");
  const [color, setColor] = useState("Silver");
  const [plate, setPlate] = useState("");
  const [zip, setZip] = useState("32502");
  return (
    <View style={{ marginTop: 12, backgroundColor: C.white, borderRadius: 18, padding: 16 }}>
      <Text style={{ fontFamily: font.heading, fontSize: 18, marginBottom: 8 }}>{id.replaceAll("_", " ")}</Text>
      {id === "vehicle" ? (
        <>
          {["Make", "Model", "Color", "Plate"].map((label) => (
            <TextInput
              key={label}
              accessibilityLabel={label}
              value={label === "Make" ? make : label === "Model" ? model : label === "Color" ? color : plate}
              onChangeText={label === "Make" ? setMake : label === "Model" ? setModel : label === "Color" ? setColor : setPlate}
              placeholder={label}
              style={input}
            />
          ))}
          <PrimaryButton label="Save vehicle" onPress={() => onVehicle({ make, model, color, plate })} />
        </>
      ) : null}
      {id === "vehicle_photo" || id === "license" || id === "insurance" ? (
        <>
          {demoMode ? (
            <Pressable onPress={() => onDoc(id)} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ textDecorationLine: "underline", fontFamily: font.semi }}>Demo: use a sample photo</Text>
            </Pressable>
          ) : null}
          <PrimaryButton label="Save photo" onPress={() => onDoc(id)} />
        </>
      ) : null}
      {id === "payouts" ? <PrimaryButton label="Set up payouts" onPress={onPayouts} /> : null}
      {id === "area" ? (
        <>
          <TextInput accessibilityLabel="ZIP" value={zip} onChangeText={setZip} keyboardType="number-pad" style={input} />
          <PrimaryButton label="Use this ZIP" onPress={() => onZip(zip)} />
        </>
      ) : null}
      <Pressable onPress={onClose} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.semi }}>Close</Text>
      </Pressable>
    </View>
  );
}

const input = {
  minHeight: 48,
  borderWidth: 1,
  borderColor: C.sand600,
  borderRadius: 12,
  paddingHorizontal: 12,
  marginBottom: 8,
  fontFamily: font.body,
  fontSize: 16,
};
