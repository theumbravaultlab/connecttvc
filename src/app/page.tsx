import { AppShell } from "@/components/AppShell";
import { getGroups, getPeople } from "@/lib/data";
import { getViewerEmail } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";

export default async function HomePage() {
  // The proxy already gated this route; every viewer here is an authorized
  // coordinator, so we load full records (incl. addresses) for the map + console.
  const [groups, people, email] = await Promise.all([
    getGroups(),
    getPeople(),
    getViewerEmail(),
  ]);

  return (
    <main className="h-dvh w-full overflow-hidden bg-white">
      <AppShell
        groups={groups}
        people={people}
        userEmail={email}
        persisted={supabaseConfigured}
      />
    </main>
  );
}
