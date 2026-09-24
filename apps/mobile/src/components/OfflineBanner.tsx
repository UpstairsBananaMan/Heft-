import { Text, View } from "react-native";
import { useOnline } from "../lib/reachability";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: 52,
        left: 16,
        right: 16,
        zIndex: 30,
        backgroundColor: "#1A1D21",
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: "#F4F1EA", fontSize: 13, lineHeight: 18 }}>
        Offline. Heft will keep trying. Tap Refresh after Wi-Fi is back. Nothing new is sent until then.
      </Text>
    </View>
  );
}
