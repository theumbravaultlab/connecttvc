import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";

// Next 16 renamed Middleware -> Proxy. This refreshes the Supabase auth
// cookie on navigation and gates the whole app (everything except /login).
export async function proxy(request: NextRequest) {
  // Seed-only mode (no Supabase yet): let everything through.
  if (!supabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  // /forgot-password is public like /login (an unauthenticated visitor
  // requesting a reset email). /reset-password is the one route that must
  // stay reachable *without* a normal session: the Supabase reset link
  // establishes a short-lived recovery session client-side (via the URL's
  // token/code, parsed by the browser SDK on load) — by the time this
  // proxy runs server-side, that exchange hasn't happened yet, so
  // requiring `user` here would redirect to /login before the page ever
  // gets a chance to set the new password.
  const isPublicAuthRoute = path === "/forgot-password" || path === "/reset-password";

  // Everything is behind auth. Unauthenticated -> /login.
  if (!user && !isLogin && !isPublicAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Already signed in? Skip the login page (but not /reset-password — a
  // signed-in user can still legitimately land there to set a new password,
  // and bouncing them away would break that flow entirely).
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets, images, and the PWA
    // manifest — browsers fetch manifest.webmanifest unauthenticated in
    // the background to decide installability, so gating it behind login
    // silently broke that check (it received the /login HTML instead of
    // JSON).
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
