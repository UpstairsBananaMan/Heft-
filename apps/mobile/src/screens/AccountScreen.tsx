import { ReactNode, useState } from "react";
import { Linking, Text } from "react-native";
import { useRouter } from "expo-router";
import { isValidPhone } from "@heft/shared";
import { Button, ErrorText, Field, Notice, Screen } from "../components/ui";
import { errorText, invoke } from "../lib/invoke";
import { registerForJobAlerts } from "../lib/push";
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
    if (!profile) return;
    const result = await registerForJobAlerts(profile.id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("This phone will get job alerts when a status changes.");
  }

  async function setupPayouts() {
    setError("");
    setMessage("");
    try {
      const result = await invoke<{ sandbox?: boolean; url?: string | null; message?: string }>("connect-onboarding", {});
      if (result.message) setMessage(result.message);
      if (result.url) await Linking.openURL(result.url);
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
      <Button label="Enable job alerts" tone="charcoal" onPress={() => void enablePush()} />
      <Text className="mb-3 text-xs leading-5 text-steel">
        Alerts stay off until an Expo project id is configured. Without it, this button explains why and does not crash.
      </Text>
      {profile?.role === "driver" ? (
        <Button label="Set up payouts" tone="charcoal" onPress={() => void setupPayouts()} />
      ) : null}
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
