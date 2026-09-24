import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { PENSACOLA_CENTER, VEHICLE_LABEL, VEHICLE_TYPES, type DriverProfile, type VehicleType } from "@heft/shared";
import { Button, Choice, ErrorText, Field, Notice, Screen } from "../../src/components/ui";
import { errorText } from "../../src/lib/invoke";
import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

export default function DriverSetup() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ["driver-profile", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*").eq("user_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data as DriverProfile | null;
    },
  });
  const row = existing.data;
  const [vehicle, setVehicle] = useState<VehicleType>("pickup");
  const [capacity, setCapacity] = useState("");
  const [bed, setBed] = useState("");
  const [lat, setLat] = useState(String(PENSACOLA_CENTER.lat));
  const [lng, setLng] = useState(String(PENSACOLA_CENTER.lng));
  const [radius, setRadius] = useState("25");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!row || hydrated) return;
    setVehicle(row.vehicle_type);
    setCapacity(row.capacity_lbs ? String(row.capacity_lbs) : "");
    setBed(row.bed_length_ft ? String(row.bed_length_ft) : "");
    setLat(String(row.service_lat));
    setLng(String(row.service_lng));
    setRadius(String(row.service_radius_miles));
    setHydrated(true);
  }, [row, hydrated]);

  async function save() {
    if (!profile) return;
    const serviceLat = Number(lat);
    const serviceLng = Number(lng);
    const serviceRadius = Number(radius);
    if (!Number.isFinite(serviceLat) || !Number.isFinite(serviceLng) || !(serviceRadius > 0)) {
      setError("Service center and radius need valid numbers.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const payload = {
        vehicle_type: vehicle,
        capacity_lbs: capacity ? Number(capacity) : null,
        bed_length_ft: bed ? Number(bed) : null,
        service_lat: serviceLat,
        service_lng: serviceLng,
        service_radius_miles: serviceRadius,
      };
      if (row) {
        const { error: updateError } = await supabase.from("driver_profiles").update(payload).eq("user_id", profile.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("driver_profiles").insert({
          user_id: profile.id,
          status: "pending",
          ...payload,
          vehicle_type: vehicle,
        });
        if (insertError) throw insertError;
      }
      await queryClient.invalidateQueries({ queryKey: ["driver-profile", profile.id] });
      router.replace("/(driver)/map");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="Vehicle" back>
      <Notice>
        {row
          ? `Approval status: ${row.status}. An admin changes that from the web console. You can update the truck and service circle.`
          : "Submit your vehicle. You stay pending until an admin approves you."}
      </Notice>
      <Choice
        label="Vehicle"
        value={vehicle}
        onChange={(value) => setVehicle(value as VehicleType)}
        options={VEHICLE_TYPES.map((value) => ({ value, label: VEHICLE_LABEL[value] }))}
      />
      <Field label="Capacity (lb)" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
      <Field label="Bed length (ft)" value={bed} onChangeText={setBed} keyboardType="numeric" />
      <Field label="Service latitude" value={lat} onChangeText={setLat} keyboardType="numeric" />
      <Field label="Service longitude" value={lng} onChangeText={setLng} keyboardType="numeric" />
      <Field label="Radius (miles)" value={radius} onChangeText={setRadius} keyboardType="numeric" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={pending ? "Saving" : row ? "Update vehicle" : "Submit for approval"} disabled={pending} onPress={save} />
    </Screen>
  );
}
