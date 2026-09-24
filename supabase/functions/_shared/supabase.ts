import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.49.8";
import { HttpError } from "./http.ts";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(500, "Supabase service role is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request): Promise<{ admin: SupabaseClient; user: User }> {
  const header = req.headers.get("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "Missing authorization");
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new HttpError(500, "Supabase anon key is not configured");
  const client = createClient(url, anon, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Invalid session");
  return { admin: adminClient(), user: data.user };
}

export function jwtRole(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}
