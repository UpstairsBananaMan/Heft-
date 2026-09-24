import { Stack, Redirect } from "expo-router";
import { useSession } from "../../src/store/session";

export default function CustomerLayout() {
  const ready = useSession((state) => state.ready);
  const profile = useSession((state) => state.profile);
  if (!ready) return null;
  if (!profile) return <Redirect href="/(auth)/welcome" />;
  if (profile.role === "driver") return <Redirect href="/(driver)/map" />;
  if (profile.role !== "customer") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
