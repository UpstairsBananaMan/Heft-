import type { ComponentType } from "react";
import { Text, View } from "react-native";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  onPress?: () => void;
};

export function JobMap({ pins, height = 280 }: { pins: MapPin[]; height?: number }) {
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
