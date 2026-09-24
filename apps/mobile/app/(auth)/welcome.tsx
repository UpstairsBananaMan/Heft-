import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Notice, Screen } from "../../src/components/ui";
import { supabaseConfigured } from "../../src/lib/supabase";

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen title="Bulky freight, dispatched.">
      <Text className="mb-6 text-base leading-6 text-steel">
        Heft moves furniture, lumber, and other loads that do not fit in a car. Pensacola only for this build. Pick a
        role when you create an account. One login, one role.
      </Text>
      {!supabaseConfigured ? (
        <Notice>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env before signing in.</Notice>
      ) : null}
      <Button label="Sign in" onPress={() => router.push("/(auth)/sign-in")} />
      <View className="h-3" />
      <Button label="Create account" tone="charcoal" onPress={() => router.push("/(auth)/sign-up")} />
    </Screen>
  );
}
