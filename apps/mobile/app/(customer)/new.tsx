import { useState } from "react";
import { Pressable, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  PENSACOLA_PLACES,
  SIZE_CATEGORIES,
  SIZE_LABEL,
  VEHICLE_LABEL,
  VEHICLE_TYPES,
  type SizeCategory,
  type VehicleType,
} from "@heft/shared";
import { BottomNav, Button, Choice, ErrorText, Field, Notice, Screen } from "../../src/components/ui";
import { errorText, invoke } from "../../src/lib/invoke";
import { uploadJobImage } from "../../src/lib/photos";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

const NAV = [
  { href: "/(customer)/home" as const, label: "Jobs" },
  { href: "/(customer)/new" as const, label: "New" },
  { href: "/(customer)/account" as const, label: "Account" },
];

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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo permission is required to attach an item picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhotos((current) => [...current, result.assets[0].uri].slice(0, 4));
  }

  async function quote() {
    if (!profile) return;
    if (item.trim().length < 3) {
      setError("Describe the item.");
      return;
    }
    setPending(true);
    setError("");
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
      router.push(`/(customer)/quote/${id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="New request" footer={<BottomNav items={NAV} />}>
      <Notice>Addresses are presets so a quote works without a Google Places key. The last preset is outside the service box.</Notice>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">Pickup</Text>
      {PENSACOLA_PLACES.map((place) => (
        <Pressable key={place.label} onPress={() => setPickup(place)} className="mb-2 border border-line bg-white px-3 py-3">
          <Text className={`text-sm font-semibold ${pickup.label === place.label ? "text-charcoal" : "text-steel"}`}>
            {pickup.label === place.label ? "● " : "○ "}
            {place.label}
          </Text>
        </Pressable>
      ))}
      <Field label="Pickup notes" value={pickupNotes} onChangeText={setPickupNotes} />
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">Drop-off</Text>
      {PENSACOLA_PLACES.map((place) => (
        <Pressable key={`drop-${place.label}`} onPress={() => setDropoff(place)} className="mb-2 border border-line bg-white px-3 py-3">
          <Text className={`text-sm font-semibold ${dropoff.label === place.label ? "text-charcoal" : "text-steel"}`}>
            {dropoff.label === place.label ? "● " : "○ "}
            {place.label}
          </Text>
        </Pressable>
      ))}
      <Field label="Drop-off notes" value={dropoffNotes} onChangeText={setDropoffNotes} />
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
      <Button label={photos.length ? `${photos.length} photo(s) selected` : "Add item photo"} tone="ghost" onPress={addPhoto} />
      <Text className="my-3 text-xs text-steel">Photos are optional at quote time.</Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Quoting" : "Get quote"} disabled={pending} onPress={quote} />
    </Screen>
  );
}
