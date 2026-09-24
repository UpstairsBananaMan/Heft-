import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { APP_NAME, driverKeepPercent } from "@heft/shared";
import { C, font, OutlineButton } from "../components/v2";
import { demoMode } from "../lib/supabase";
import { demoPerson, setDemoRole } from "../lib/demo-client";
import { errorText, invoke } from "../lib/invoke";
import { useSession } from "../store/session";
import type { Session } from "@supabase/supabase-js";

export function AccountScreen() {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const signOut = useSession((state) => state.signOut);
  const refreshProfile = useSession((state) => state.refreshProfile);
  const [error, setError] = useState("");
  const first = profile?.display_name?.slice(0, 1) ?? "?";

  async function remove() {
    setError("");
    try {
      await invoke("delete-account", {});
      await signOut();
      router.replace("/(auth)/welcome");
    } catch (err) {
      setError(errorText(err));
    }
  }

  function confirmDelete() {
    Alert.alert("Delete account permanently?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);
  }

  async function switchRole(role: "customer" | "driver") {
    const person = demoPerson(role);
    setDemoRole(role);
    useSession.setState({ session: { user: { id: person.id, email: person.email } } as Session, profile: null });
    await refreshProfile();
    router.replace("/");
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <Text style={{ fontFamily: font.heading, fontSize: 28, marginBottom: 16 }}>Profile</Text>
      <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.sand150, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semi, fontSize: 18 }}>{first}</Text>
        </View>
        <View>
          <Text style={{ fontFamily: font.semi, fontSize: 17 }}>{profile?.display_name}</Text>
          <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14 }}>{profile?.phone || "Add a phone number"}</Text>
        </View>
      </View>
      <View style={{ marginTop: 16, backgroundColor: C.white, borderRadius: 18 }}>
        <Row label="Help" onPress={() => router.push("/legal/terms")} />
        <Row label="Privacy Policy" onPress={() => router.push("/legal/privacy")} />
        <Row label="Terms of Service" onPress={() => router.push("/legal/terms")} />
      </View>
      {profile?.role === "customer" ? (
        <Text style={{ marginTop: 16, color: C.steel, fontFamily: font.body, fontSize: 15 }}>
          Want to earn with your truck? Drive with {APP_NAME}. Driving uses a separate account for now.
        </Text>
      ) : (
        <Text style={{ marginTop: 16, color: C.steel, fontFamily: font.body, fontSize: 15 }}>
          Need something moved? Book with a customer account. Keep {driverKeepPercent()}% of every fare.
        </Text>
      )}
      {demoMode ? (
        <View style={{ marginTop: 16, backgroundColor: C.white, borderRadius: 18, padding: 16 }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16, marginBottom: 8 }}>Demo</Text>
          <OutlineButton label="Customer demo" onPress={() => void switchRole("customer")} />
          <View style={{ height: 8 }} />
          <OutlineButton label="Driver demo" onPress={() => void switchRole("driver")} />
        </View>
      ) : null}
      <View style={{ marginTop: 24 }}>
        <Pressable onPress={() => void signOut().then(() => router.replace("/(auth)/welcome"))} style={{ minHeight: 48, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semi, fontSize: 16 }}>Sign out</Text>
        </Pressable>
        <Pressable onPress={confirmDelete} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Trash2 color={C.red} size={18} />
          <Text style={{ color: C.red, fontFamily: font.semi, fontSize: 16 }}>Delete account</Text>
        </Pressable>
        {error ? <Text style={{ color: C.red, fontFamily: font.body, fontSize: 14 }}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.sand200 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
