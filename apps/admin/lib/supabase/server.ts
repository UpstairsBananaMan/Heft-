import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminDemoClient, demoModeEnabled } from "../demo-store";

export async function createClient() {
  if (demoModeEnabled()) return createAdminDemoClient() as unknown as Awaited<ReturnType<typeof createServerClient>>;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies. Middleware refreshes the session.
          }
        },
      },
    },
  );
}
