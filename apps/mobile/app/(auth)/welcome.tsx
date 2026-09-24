import { Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { Button, Notice, Screen } from "../../src/components/ui";
import { demoPerson, setDemoRole } from "../../src/lib/demo-client";
import { demoMode, supabaseConfigured } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";

export default function Welcome() {
  const router = useRouter();
  const refreshProfile = useSession((state) => state.refreshProfile);

  async function review(role: "customer" | "driver") {
    const person = demoPerson(role);
    setDemoRole(role);
    useSession.setState({
      ready: true,
      session: { user: { id: person.id, email: person.email } } as Session,
    });
    await refreshProfile();
    router.replace("/");
  }

  return (
    <Screen title="Bulky freight, dispatched.">
      <Text className="mb-6 text-base leading-6 text-steel">
        Heft moves furniture, lumber, and other loads that do not fit in a car. Pensacola only for this build. Pick a
        role when you create an account. One login, one role.
      </Text>
      {demoMode ? (
        <Notice>Demo mode. Sample jobs and prices are already loaded. No account, card, or map key is required.</Notice>
      ) : null}
      {!demoMode && !supabaseConfigured ? (
        <Notice>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env before signing in.</Notice>
      ) : null}
      {demoMode ? (
        <>
          <Button label="Review as customer" onPress={() => void review("customer")} />
          <View className="h-3" />
          <Button label="Review as driver" tone="charcoal" onPress={() => void review("driver")} />
          <View className="h-3" />
        </>
      ) : null}
      <Button label="Sign in" onPress={() => router.push("/(auth)/sign-in")} />
      <View className="h-3" />
      <Button label="Create account" tone="charcoal" onPress={() => router.push("/(auth)/sign-up")} />
    </Screen>
  );
}
