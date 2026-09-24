import { Stack, Redirect } from "expo-router";
import { useSession } from "../../src/store/session";

export default function AuthLayout() {
  const ready = useSession((state) => state.ready);
  const profile = useSession((state) => state.profile);
  if (!ready) return null;
  if (profile?.role === "customer") return <Redirect href="/(customer)/home" />;
  if (profile?.role === "driver") return <Redirect href="/(driver)/map" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
