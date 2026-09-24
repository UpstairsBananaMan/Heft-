import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { APP_NAME } from "@heft/shared";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Present only after `eas init` or EXPO_PUBLIC_EAS_PROJECT_ID. Never hardcoded. */
export function easProjectId(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId?.trim();
  const fromEas = Constants.easConfig?.projectId?.trim();
  const id = fromEnv || fromExtra || fromEas || "";
  return id.length > 0 ? id : null;
}

export async function registerForJobAlerts(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const projectId = easProjectId();
  if (!projectId) {
    return {
      ok: false,
      message:
        `Job alerts turn on after an Expo project id is set. Run eas init, or set EXPO_PUBLIC_EAS_PROJECT_ID. ${APP_NAME} still works without alerts.`,
    };
  }
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return { ok: false, message: "Job alerts are for the iPhone and Android apps." };
  }
  if (!Device.isDevice) {
    return { ok: false, message: "Use a physical phone for job alerts. A simulator usually cannot get a push token." };
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (granted.status !== "granted") {
    return { ok: false, message: `Notification permission was denied. ${APP_NAME} still works without alerts.` };
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      token: token.data,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
