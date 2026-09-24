import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMobileDemo, demoMode } from "./demo-client";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHUNK = 1800;

export { demoMode };
export const supabaseConfigured = demoMode || Boolean(url && anonKey);

/**
 * Session tokens stay in the device keystore on iOS and Android.
 * SecureStore values are size-limited, so the session JSON is split into chunks.
 * Web (Expo web) falls back to AsyncStorage.
 */
const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    if (!countRaw) return null;
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      parts.push((await SecureStore.getItemAsync(`${key}.${index}`)) ?? "");
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    const previous = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? "0");
    for (let index = 0; index < count; index += 1) {
      await SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
    }
    for (let index = count; index < previous; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`);
    }
    await SecureStore.setItemAsync(`${key}.n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    const previous = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? "0");
    for (let index = 0; index < previous; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.${index}`);
    }
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

const liveClient = createClient(url || "http://127.0.0.1:54321", anonKey || "missing-anon-key", {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

export const supabase = (demoMode ? createMobileDemo() : liveClient) as SupabaseClient;

if (!demoMode && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
