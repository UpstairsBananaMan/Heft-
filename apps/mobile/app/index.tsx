import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "../src/store/session";

export default function Index() {
  const ready = useSession((state) => state.ready);
  const session = useSession((state) => state.session);
  const profile = useSession((state) => state.profile);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1A1D21", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#E8A317" />
      </View>
    );
  }
  if (!session || !profile) return <Redirect href="/(auth)/welcome" />;
  if (profile.role === "driver") return <Redirect href="/(driver)/map" />;
  if (profile.role === "customer") return <Redirect href="/(customer)/home" />;
  return (
    <View style={{ flex: 1, backgroundColor: "#F4F1EA", padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "600", color: "#1A1D21" }}>Admin account</Text>
      <Text style={{ marginTop: 12, color: "#5C6670", lineHeight: 22 }}>
        This login is the seeded admin. Use the web console at localhost:3000. The mobile app is for customers and drivers.
      </Text>
    </View>
  );
}
