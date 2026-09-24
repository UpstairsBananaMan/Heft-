import type { ComponentType } from "react";
import { Platform, Pressable, Text, View } from "react-native";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  onPress?: () => void;
};

export function JobMap({ pins, height = 280 }: { pins: MapPin[]; height?: number }) {
  if (Platform.OS === "web") {
    return (
      <View className="bg-charcoal px-4 py-4" style={{ height, overflow: "hidden" }}>
        <Text className="text-[11px] font-semibold uppercase tracking-widest text-amber">Pensacola list map</Text>
        <Text className="mt-1 text-xs leading-5 text-paper/80">The live map opens on iPhone and Android. Stops are listed here.</Text>
        {pins.map((pin) => (
          <Pressable key={pin.id} onPress={pin.onPress} className="mt-3">
            <Text className="text-sm font-semibold text-paper">{pin.title}</Text>
            <Text className="text-xs text-paper/70">
              {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
            </Text>
          </Pressable>
        ))}
        {pins.length === 0 ? <Text className="mt-3 text-sm text-paper">No stops on this job.</Text> : null}
      </View>
    );
  }

  try {
    const maps = require("react-native-maps") as {
      default: ComponentType<Record<string, unknown>>;
      Marker: ComponentType<Record<string, unknown>>;
    };
    const MapView = maps.default;
    const Marker = maps.Marker;
    const first = pins[0];
    const region = {
      latitude: first?.lat ?? 30.4213,
      longitude: first?.lng ?? -87.2169,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    };
    return (
      <MapView style={{ height }} initialRegion={region}>
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            title={pin.title}
            pinColor="#E8A317"
            onPress={pin.onPress}
          />
        ))}
      </MapView>
    );
  } catch {
    return (
      <View className="justify-center bg-charcoal px-4" style={{ height }}>
        <Text className="text-sm text-paper">Map unavailable in this build. Use the job list.</Text>
      </View>
    );
  }
}
