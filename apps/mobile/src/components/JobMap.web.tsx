import { Pressable, Text, View } from "react-native";

type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  onPress?: () => void;
};

export function JobMap({ pins, height = 280 }: { pins: MapPin[]; height?: number }) {
  return (
    <View className="bg-charcoal px-4 py-4" style={{ minHeight: height }}>
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
