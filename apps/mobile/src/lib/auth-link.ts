import * as Linking from "expo-linking";
import { supabase } from "./supabase";

/** Finish an email-confirm or recovery link. Ignores ordinary app URLs. */
export async function completeAuthFromUrl(url: string | null): Promise<boolean> {
  if (!url || (!url.includes("auth/callback") && !url.includes("access_token") && !url.includes("code="))) {
    return false;
  }
  const parsed = Linking.parse(url);
  const codeParam = parsed.queryParams?.code;
  const code = typeof codeParam === "string" ? codeParam : null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return true;
  }
  return false;
}

export function authRedirectUrl(): string {
  return Linking.createURL("/auth/callback");
}
