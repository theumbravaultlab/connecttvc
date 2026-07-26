import { AppShell } from "@/components/AppShell";
import { getGroups, getPeople } from "@/lib/data";
import { getViewerEmail } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";

// The proxy already gated every route under here; every viewer is an
// authorized coordinator, so we load full records (incl. addresses) once at
// this shared layout — Map, and every Directory list/edit page, read them
// from AppShell's context instead of each route re-fetching.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [groups, people, email] = await Promise.all([
    getGroups(),
    getPeople(),
    getViewerEmail(),
  ]);

  return (
    <main className="h-dvh w-full overflow-hidden bg-[var(--surface)] print:h-auto print:overflow-visible">
      <AppShell
        groups={groups}
        people={people}
        userEmail={email}
        persisted={supabaseConfigured}
      >
        {children}
      </AppShell>
    </main>
  );
}
