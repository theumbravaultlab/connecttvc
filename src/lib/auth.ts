import { getServerSupabase } from "./supabase/server";

/** Email of the current signed-in user, or null (incl. seed/demo mode). */
export async function getViewerEmail(): Promise<string | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/** Whether the current viewer is an authenticated leader/admin. */
export async function getViewerIsLeader(): Promise<boolean> {
  const supabase = await getServerSupabase();
  if (!supabase) return false; // seed/demo mode
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role === "leader" || data?.role === "admin";
}
