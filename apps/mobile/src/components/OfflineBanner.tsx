import { Text, View } from "react-native";
import { APP_NAME } from "@heft/shared";
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
        You're offline. {APP_NAME} will keep trying. You can start a booking when you're back online.
      </Text>
    </View>
  );
}
