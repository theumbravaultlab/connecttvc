"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client, or null when not configured. Memoized — calling
 * createBrowserClient() more than once triggers Supabase's own "Multiple
 * GoTrueClient instances detected" warning and risks auth state drifting
 * out of sync between instances. */
export function getBrowserSupabase() {
  if (!supabaseConfigured) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
