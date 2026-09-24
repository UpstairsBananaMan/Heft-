import { Pressable, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { demoPerson, setDemoRole } from "../lib/demo-client";
import { useSession } from "../store/session";

export function DemoSwitch() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useSession((state) => state.profile?.role);
  const refreshProfile = useSession((state) => state.refreshProfile);

  async function choose(next: "customer" | "driver") {
    const person = demoPerson(next);
    setDemoRole(next);
    useSession.setState({
      ready: true,
      session: { user: { id: person.id, email: person.email } } as Session,
    });
    queryClient.clear();
    await refreshProfile();
    router.replace(next === "driver" ? "/(driver)/map" : "/(customer)/home");
  }

  return (
    <View className="mt-3 flex-row items-center">
      <Text className="mr-3 bg-amber px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-charcoal">Demo</Text>
      <Pressable onPress={() => void choose("customer")} className="mr-3 py-1">
        <Text className={`text-xs font-semibold uppercase tracking-wider ${role === "customer" ? "text-amber" : "text-paper"}`}>Customer</Text>
      </Pressable>
      <Pressable onPress={() => void choose("driver")} className="py-1">
        <Text className={`text-xs font-semibold uppercase tracking-wider ${role === "driver" ? "text-amber" : "text-paper"}`}>Driver</Text>
      </Pressable>
    </View>
  );
}
