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

/** The signed-in user's id/email plus their profiles.full_name (which
 * defaults to their email at signup until they set a real display name —
 * see handle_new_user() in schema.sql). Null in seed/demo mode or when
 * signed out. */
export async function getViewerProfile(): Promise<{
  id: string;
  email: string | null;
  fullName: string | null;
} | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  return { id: user.id, email: user.email ?? null, fullName: profile?.full_name ?? null };
}

/** The name to attribute an action to — prefers the viewer's own display
 * name, falls back to their email. This is what every "who did this"
 * snapshot field (contact log, placement history, created/updated by)
 * should call, instead of getViewerEmail() directly, so a coordinator's
 * chosen display name actually shows up everywhere it's supposed to. */
export async function getViewerDisplayName(): Promise<string | null> {
  const profile = await getViewerProfile();
  if (!profile) return null;
  return profile.fullName?.trim() || profile.email;
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
