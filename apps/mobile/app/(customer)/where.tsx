import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeftRight, ArrowLeft, Clock, LocateFixed, MapPin } from "lucide-react-native";
import { filterPlaces, haversineMiles, PENSACOLA_CENTER, type PlacePreset } from "@heft/shared";
import { demoMode } from "../../src/lib/supabase";
import { haptic } from "../../src/lib/haptics";
import { useBooking } from "../../src/store/booking";
import { C, font } from "../../src/components/v2";

export default function WhereScreen() {
  const router = useRouter();
  const booking = useBooking();
  const [focus, setFocus] = useState<"pickup" | "dropoff">(booking.pickup ? "dropoff" : "pickup");
  const [pickupText, setPickupText] = useState(booking.pickup?.address ?? "");
  const [dropText, setDropText] = useState(booking.dropoff?.address ?? "");
  const query = focus === "pickup" ? pickupText : dropText;
  const results = useMemo(() => (demoMode ? filterPlaces(query) : []), [query]);

  function choose(place: PlacePreset) {
    haptic.select();
    if (focus === "pickup") {
      booking.setPickup(place);
      setPickupText(place.address);
      setFocus("dropoff");
      if (booking.dropoff && booking.dropoff.address !== place.address) {
        booking.patch({ step: "item" });
        router.back();
      }
      return;
    }
    booking.setDropoff(place);
    setDropText(place.address);
    const pickup = booking.pickup;
    if (pickup && pickup.address !== place.address) {
      booking.patch({ step: "item" });
      router.back();
    } else {
      setFocus("pickup");
    }
  }

  function useLocation() {
    const here: PlacePreset = {
      label: "Current location",
      address: "1200 E Gadsden St, Pensacola",
      lat: PENSACOLA_CENTER.lat,
      lng: PENSACOLA_CENTER.lng,
    };
    booking.setPickup(here);
    setPickupText("Current location");
    setFocus("dropoff");
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 54, paddingHorizontal: 16, gap: 10 }}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={iconBtn}>
          <ArrowLeft color={C.ink} size={20} />
        </Pressable>
        <Text style={{ fontFamily: font.heading, fontSize: 22, color: C.ink }}>Where’s it going?</Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 16, alignItems: "center", paddingTop: 22 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.amber, borderWidth: 2, borderColor: C.ink }} />
            <View style={{ width: 2, flex: 1, borderStyle: "dotted", borderLeftWidth: 2, borderColor: C.sand300, marginVertical: 4 }} />
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.amber, borderWidth: 2, borderColor: C.ink }} />
          </View>
          <View style={{ flex: 1 }}>
            <AddressField
              label="Pickup · Current location"
              value={pickupText}
              placeholder="Pickup address"
              onFocus={() => setFocus("pickup")}
              onChangeText={(value) => {
                setPickupText(value);
                booking.setPickup(null);
              }}
            />
            <AddressField
              label="Drop-off"
              value={dropText}
              placeholder="Drop-off"
              autoFocus
              onFocus={() => setFocus("dropoff")}
              onChangeText={(value) => {
                setDropText(value);
                booking.setDropoff(null);
              }}
            />
          </View>
          <Pressable
            accessibilityLabel="Swap pickup and drop-off"
            onPress={() => {
              booking.swap();
              const next = useBooking.getState();
              setPickupText(next.pickup?.address ?? "");
              setDropText(next.dropoff?.address ?? "");
              haptic.select();
            }}
            style={[iconBtn, { alignSelf: "center" }]}
          >
            <ArrowLeftRight color={C.ink} size={18} />
          </Pressable>
        </View>
        {focus === "pickup" ? (
          <Pressable onPress={useLocation} style={row}>
            <View style={tile}>
              <LocateFixed color={C.amberInk} size={18} />
            </View>
            <Text style={rowTitle}>Use my location</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text style={overline}>{results.length ? "Results" : "Recent"}</Text>
        {(results.length ? results : demoMode ? recent : []).map((place) => (
          <Pressable key={place.address} onPress={() => choose(place)} style={row}>
            <View style={[tile, { backgroundColor: C.sand150 }]}>
              {place.label === "Home" || place.label === "Work" ? <Clock color={C.steel} size={18} /> : <MapPin color={C.steel} size={18} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle}>{place.label}</Text>
              <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14 }}>{place.address}</Text>
            </View>
            <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14 }}>
              {haversineMiles(PENSACOLA_CENTER.lat, PENSACOLA_CENTER.lng, place.lat, place.lng).toFixed(1)} mi
            </Text>
          </Pressable>
        ))}
        {query.trim().length >= 3 && results.length === 0 ? (
          <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 16, marginTop: 12 }}>
            No matches in the Pensacola area. Check the spelling or try a nearby street.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const recent: PlacePreset[] = [
  { label: "Home", address: "1200 E Gadsden St, Pensacola", lat: 30.436, lng: -87.191 },
  { label: "412 N Spring St", address: "412 N Spring St, North Hill, Pensacola", lat: 30.4165, lng: -87.221 },
  { label: "Work", address: "7171 N Davis Hwy, Pensacola", lat: 30.498, lng: -87.208 },
];

function AddressField({
  label,
  value,
  placeholder,
  onChangeText,
  onFocus,
  autoFocus,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ marginBottom: 8, borderWidth: 1, borderColor: C.sand600, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, minHeight: 60, justifyContent: "center" }}>
      <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 12 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={C.steel500}
        onChangeText={onChangeText}
        onFocus={onFocus}
        autoFocus={autoFocus}
        style={{ color: C.ink, fontFamily: font.semi, fontSize: 16, padding: 0 }}
      />
    </View>
  );
}

const iconBtn = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: C.sand150,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const tile = {
  width: 40,
  height: 40,
  borderRadius: 14,
  backgroundColor: C.amber50,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const row = { minHeight: 56, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingVertical: 8 };
const rowTitle = { color: C.ink, fontFamily: font.semi, fontSize: 16 };
const overline = { marginTop: 16, marginBottom: 6, color: C.steel, fontFamily: font.semi, fontSize: 12, letterSpacing: 0.8 };
