import MapView, { Marker, Polyline } from "react-native-maps";
import { mapStyle } from "@heft/shared";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  kind?: "pickup" | "dropoff" | "driver" | "payout" | "user";
  payout?: string;
  hot?: boolean;
  onPress?: () => void;
};

const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: mapStyle.land }] },
  { elementType: "labels.text.fill", stylers: [{ color: mapStyle.label }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: mapStyle.water }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: mapStyle.park }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: mapStyle.roadMinor }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: mapStyle.roadMajor }] },
];

export function JobMap({
  pins,
  height,
  route = true,
}: {
  pins: MapPin[];
  height?: number;
  bottomInset?: number;
  route?: boolean;
}) {
  const stops = pins.filter((pin) => pin.kind !== "payout");
  const first = stops[0];
  const region = {
    latitude: first?.lat ?? 30.4213,
    longitude: first?.lng ?? -87.2169,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
  const line = pins.filter((pin) => pin.kind === "pickup" || pin.kind === "dropoff");
  return (
    <MapView style={{ flex: height ? undefined : 1, height }} initialRegion={region} customMapStyle={customMapStyle}>
      {route && line.length >= 2 ? (
        <Polyline
          coordinates={line.map((pin) => ({ latitude: pin.lat, longitude: pin.lng }))}
          strokeColor={mapStyle.route}
          strokeWidth={mapStyle.routeWidth}
        />
      ) : null}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title={pin.payout ?? pin.title}
          pinColor={pin.kind === "driver" ? "#1A1D21" : "#E8A317"}
          tracksViewChanges={false}
          onPress={pin.onPress}
        />
      ))}
    </MapView>
  );
}
