import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { ArrowRight, Bell, Sofa, Truck } from "lucide-react-native";
import { APP_NAME, driversApprovedLabel } from "@heft/shared";
import { demoPerson, setDemoRole } from "../../src/lib/demo-client";
import { demoMode, supabase, supabaseConfigured } from "../../src/lib/supabase";
import { useSession } from "../../src/store/session";
import { C, font, Wordmark } from "../../src/components/v2";

export default function Welcome() {
  const router = useRouter();
  const refreshProfile = useSession((state) => state.refreshProfile);
  const [pending, setPending] = useState(false);

  async function enter(role: "customer" | "driver", anonymous = false) {
    setPending(true);
    try {
      if (demoMode) {
        const person = demoPerson(role);
        setDemoRole(role);
        useSession.setState({
          ready: true,
          session: { user: { id: person.id, email: person.email } } as Session,
        });
      } else if (anonymous) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        useSession.setState({ ready: true, session: data.session });
      } else {
        router.push("/(auth)/sign-up");
        return;
      }
      await refreshProfile();
      router.replace("/");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flex: 1.15, backgroundColor: C.ink, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 28 }}>
        <Wordmark size={30} />
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 28,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#3A3424",
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Bell color={C.amber} size={14} />
          <Text style={{ color: C.amber, fontFamily: font.semi, fontSize: 13 }}>Now moving in Pensacola</Text>
        </View>
        <Text style={{ marginTop: 22, color: C.paper, fontFamily: font.display, fontSize: 40, lineHeight: 44 }}>
          Big stuff,{"\n"}moved today.
        </Text>
        <Text style={{ marginTop: 14, color: "#C8C2B8", fontFamily: font.body, fontSize: 17, lineHeight: 26 }}>
          Couches, appliances and materials — picked up and delivered by local drivers approved by {APP_NAME}.
        </Text>
        <View style={{ marginTop: 16, gap: 6 }}>
          {["See your price before you book", "Pay after your delivery photo", driversApprovedLabel().replace("Drivers", "Local drivers")].map(
            (line) => (
              <Text key={line} style={{ color: "#E7E2D8", fontFamily: font.medium, fontSize: 14 }}>
                ✓ {line}
              </Text>
            ),
          )}
        </View>
      </View>
      <View style={{ backgroundColor: C.paper, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void enter("customer", true)}
          style={{ backgroundColor: C.amber, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(26,29,33,0.08)", alignItems: "center", justifyContent: "center" }}>
            <Sofa color={C.ink} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontFamily: font.heading, fontSize: 18 }}>I need something moved</Text>
            <Text style={{ color: C.ink, fontFamily: font.body, fontSize: 14, marginTop: 2 }}>Get an all-in price in a minute</Text>
          </View>
          <ArrowRight color={C.ink} size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void enter("driver")}
          style={{
            marginTop: 12,
            backgroundColor: C.white,
            borderRadius: 18,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Truck color={C.amber} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontFamily: font.heading, fontSize: 18 }}>I want to drive</Text>
            <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 14, marginTop: 2 }}>Earn with your truck or van</Text>
          </View>
          <ArrowRight color={C.steel400} size={18} />
        </Pressable>
        <Pressable onPress={() => router.push("/(auth)/sign-in")} style={{ minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
          <Text style={{ color: C.steel, fontFamily: font.body, fontSize: 15 }}>
            Already have an account? <Text style={{ color: C.ink, fontFamily: font.semi, textDecorationLine: "underline" }}>Sign in</Text>
          </Text>
        </Pressable>
        {demoMode ? (
          <Text style={{ textAlign: "center", color: C.steel, fontFamily: font.body, fontSize: 13 }}>
            Demo: explore without an account.{" "}
            <Text onPress={() => void enter("customer", true)} style={{ textDecorationLine: "underline", color: C.ink }}>
              Customer demo
            </Text>
            {" · "}
            <Text onPress={() => void enter("driver")} style={{ textDecorationLine: "underline", color: C.ink }}>
              Driver demo
            </Text>
          </Text>
        ) : null}
        {!demoMode && !supabaseConfigured ? (
          <Text style={{ textAlign: "center", color: C.steel, fontSize: 13, marginTop: 8 }}>
            Add the Supabase URL and anon key before signing in.
          </Text>
        ) : null}
        {pending ? <Text style={{ textAlign: "center", marginTop: 6, color: C.steel }}>Opening…</Text> : null}
      </View>
    </View>
  );
}
