import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function requireAdmin(): Promise<
  | { configured: false }
  | { configured: true; supabase: SupabaseClient; user: User; displayName: string }
> {
  if (!supabaseConfigured()) return { configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("role, display_name")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/login?reason=not-admin");
  }
  return {
    configured: true,
    supabase,
    user: data.user,
    displayName: profile.display_name,
  };
}
