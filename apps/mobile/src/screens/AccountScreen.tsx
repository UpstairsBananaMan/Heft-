import { ReactNode, useState } from "react";
import { Platform, Text } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { isValidPhone } from "@heft/shared";
import { Button, ErrorText, Field, Notice, Screen } from "../components/ui";
import { errorText } from "../lib/invoke";
import { supabase } from "../lib/supabase";
import { useSession } from "../store/session";

export function AccountScreen({
  homeHref,
  footer,
}: {
  homeHref: "/(customer)/home" | "/(driver)/map";
  footer?: ReactNode;
}) {
  const router = useRouter();
  const profile = useSession((state) => state.profile);
  const refreshProfile = useSession((state) => state.refreshProfile);
  const signOut = useSession((state) => state.signOut);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!profile) return;
    if (name.trim().length < 2) {
      setError("Display name needs at least 2 characters.");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      setError("Phone needs at least 10 digits, or leave it blank.");
      return;
    }
    setError("");
    const { error: updateError } = await supabase
      .from("users")
      .update({ display_name: name.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshProfile();
    setMessage("Saved.");
  }

  async function enablePush() {
    setError("");
    setMessage("");
    try {
      if (!profile) return;
      if (Platform.OS !== "ios" && Platform.OS !== "android") {
        throw new Error("Push tokens are stored for iOS and Android.");
      }
      if (!Device.isDevice) throw new Error("Use a physical device for an Expo push token.");
      const current = await Notifications.getPermissionsAsync();
      const granted =
        current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
      if (granted.status !== "granted") throw new Error("Notification permission denied.");
      const token = await Notifications.getExpoPushTokenAsync();
      const { error: upsertError } = await supabase.from("device_tokens").upsert(
        {
          user_id: profile.id,
          token: token.data,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );
      if (upsertError) throw upsertError;
      setMessage("This device will get job alerts.");
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Screen title="Account" footer={footer}>
      <Text className="mb-4 text-xs font-semibold uppercase tracking-wider text-steel">{profile?.role}</Text>
      <Field label="Display name" value={name} onChangeText={setName} />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {message ? <Notice>{message}</Notice> : null}
      <Button label="Save profile" onPress={save} />
      <ViewGap />
      <Button label="Enable job alerts" tone="charcoal" onPress={enablePush} />
      {profile?.role === "driver" ? (
        <>
          <ViewGap />
          <Button label="Vehicle profile" tone="ghost" onPress={() => router.push("/(driver)/setup")} />
        </>
      ) : null}
      <ViewGap />
      <Button label="Privacy Policy (draft)" tone="ghost" onPress={() => router.push("/legal/privacy")} />
      <Button label="Terms of Service (draft)" tone="ghost" onPress={() => router.push("/legal/terms")} />
      <Text className="mb-4 text-xs leading-5 text-steel">
        Those pages are drafts, not legal advice. The same text is on the admin site at /legal/privacy and /legal/terms.
      </Text>
      <Button
        label="Sign out"
        tone="ghost"
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/welcome");
        }}
      />
      <Text className="mt-6 text-xs leading-5 text-steel">Home route {homeHref} stays on this role. Dual-role accounts are out of scope.</Text>
    </Screen>
  );
}

function ViewGap() {
  return <Text className="h-3"> </Text>;
}
