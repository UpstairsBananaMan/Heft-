import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  PENSACOLA_PLACES,
  SIZE_CATEGORIES,
  SIZE_LABEL,
  VEHICLE_LABEL,
  VEHICLE_TYPES,
  type PlacePreset,
  type SizeCategory,
  type VehicleType,
} from "@heft/shared";
import { BottomNav, Button, Choice, Field, Notice, Screen, Steps } from "../../src/components/ui";
import { track } from "../../src/lib/analytics";
import { errorText, invoke } from "../../src/lib/invoke";
import { uploadJobImage } from "../../src/lib/photos";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";
import { toast } from "../../src/store/toast";

const NAV = [
  { href: "/(customer)/home" as const, label: "Jobs" },
  { href: "/(customer)/new" as const, label: "New" },
  { href: "/(customer)/account" as const, label: "Account" },
];

function PlaceList({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlacePreset;
  onChange: (place: PlacePreset) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">{label}</Text>
      {PENSACOLA_PLACES.map((place) => {
        const selected = place.label === value.label;
        return (
          <Pressable
            key={`${label}-${place.label}`}
            onPress={() => onChange(place)}
            className={`mb-2 min-h-[48px] justify-center border px-3 py-2 ${selected ? "border-charcoal bg-charcoal" : "border-line bg-white"}`}
          >
            <Text className={`text-sm font-semibold ${selected ? "text-paper" : "text-charcoal"}`}>{place.label}</Text>
            <Text className={`text-xs ${selected ? "text-paper/70" : "text-steel"}`}>{place.address}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NewJob() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const [pickup, setPickup] = useState(PENSACOLA_PLACES[0]);
  const [dropoff, setDropoff] = useState(PENSACOLA_PLACES[1]);
  const [pickupNotes, setPickupNotes] = useState("");
  const [dropoffNotes, setDropoffNotes] = useState("");
  const [item, setItem] = useState("");
  const [size, setSize] = useState<SizeCategory>("medium");
  const [vehicle, setVehicle] = useState<VehicleType>("pickup");
  const [photos, setPhotos] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function fail(message: string) {
    toast(message);
  }

  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      fail("Photo permission is required to attach an item picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhotos((current) => [...current, result.assets[0].uri].slice(0, 4));
  }

  async function quote() {
    if (!profile) return;
    if (pickup.label === dropoff.label) {
      fail("Pickup and drop-off need to be different stops.");
      return;
    }
    if (item.trim().length < 3) {
      fail("Describe the item in a few words.");
      return;
    }
    setPending(true);
    try {
      const payload = {
        customer_id: profile.id,
        status: "draft" as const,
        pickup_address: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_notes: pickupNotes || null,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_notes: dropoffNotes || null,
        item_description: item.trim(),
        size_category: size,
        vehicle_required: vehicle,
      };
      let id = jobId;
      if (!id) {
        const { data, error: insertError } = await supabase.from("jobs").insert(payload).select("id").single();
        if (insertError) throw insertError;
        id = data.id;
        setJobId(id);
      } else {
        const { error: updateError } = await supabase
          .from("jobs")
          .update(payload)
          .eq("id", id)
          .in("status", ["draft", "priced"]);
        if (updateError) throw updateError;
      }
      if (!id) throw new Error("Job was not saved");
      for (const uri of photos) {
        await uploadJobImage("job-photos", id, uri);
      }
      setPhotos([]);
      await invoke("quote", { job_id: id });
      track({ name: "quote_requested" });
      router.push(`/(customer)/quote/${id}`);
    } catch (err) {
      fail(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="New request" footer={<BottomNav items={NAV} />}>
      <Steps labels={["Stops", "Load", "Price"]} current={item.trim().length >= 3 ? 1 : 0} />
      <Notice>Pick two Pensacola stops. The last one sits outside the service box and is only for testing the rejection.</Notice>
      <PlaceList label="Pickup" value={pickup} onChange={setPickup} />
      <Field label="Pickup notes" value={pickupNotes} onChangeText={setPickupNotes} placeholder="Gate code, floor" />
      <PlaceList label="Drop-off" value={dropoff} onChange={setDropoff} />
      <Field label="Drop-off notes" value={dropoffNotes} onChangeText={setDropoffNotes} placeholder="Leave in the garage" />
      <Field label="Item" value={item} onChangeText={setItem} placeholder="Sofa, 3 seat" multiline />
      <Choice
        label="Size"
        value={size}
        onChange={(value) => setSize(value as SizeCategory)}
        options={SIZE_CATEGORIES.map((value) => ({ value, label: SIZE_LABEL[value] }))}
      />
      <Choice
        label="Vehicle required"
        value={vehicle}
        onChange={(value) => setVehicle(value as VehicleType)}
        options={VEHICLE_TYPES.map((value) => ({ value, label: VEHICLE_LABEL[value] }))}
      />
      <Button label={photos.length ? `${photos.length} item photo${photos.length === 1 ? "" : "s"} attached` : "Add item photo"} tone="ghost" onPress={addPhoto} />
      <Text className="mb-3 text-xs leading-5 text-steel">Photos are optional until you publish. The next screen is the price.</Text>
      <Button label={pending ? "Getting quote" : "Get quote"} disabled={pending} onPress={quote} />
    </Screen>
  );
}
