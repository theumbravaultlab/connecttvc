import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

/**
 * Server-side Supabase client bound to the request cookies.
 * Returns `null` when Supabase env is not yet configured so callers can
 * fall back to seed data.
 */
export async function getServerSupabase() {
  if (!supabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; the proxy
          // refreshes the session cookie on navigation.
        }
      },
    },
  });
}
