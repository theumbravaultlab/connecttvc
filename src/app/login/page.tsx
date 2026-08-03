"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { HomeMark } from "@/components/icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Full reload so the server picks up the new session cookie.
    window.location.href = "/";
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--page-bg)] p-6">
      <div
        className="w-full max-w-[400px] rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-8"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-5 flex items-center gap-2.5">
          <HomeMark />
          <span className="font-[family-name:var(--font-fredoka)] text-[20px] font-semibold text-[var(--ink)]">
            Connect TVC
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
          Sign in
        </h1>
        <p className="mt-1 text-[13px] font-semibold text-[var(--faint)]">
          For authorized coordinators and group leaders.
        </p>

        {!supabaseConfigured ? (
          <div className="mt-5 rounded-xl bg-[var(--amber-bg)] p-4 text-[13px] font-semibold leading-relaxed text-[var(--amber-fg)]">
            Sign-in turns on once Supabase keys are added to{" "}
            <code>.env.local</code>.
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--faint)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@church.org"
                className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-[12px] font-bold text-[var(--faint)]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] font-bold text-[var(--brand-blue)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
              />
            </div>
            {error && (
              <p className="text-[12px] font-semibold text-[oklch(0.55_0.18_20)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-[12px] font-semibold text-[var(--faint)]">
              Accounts are created by an administrator. Contact your coordinator
              if you need access.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
