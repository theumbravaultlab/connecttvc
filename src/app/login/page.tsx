"use client";

import { useState } from "react";
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
    <main className="flex min-h-dvh items-center justify-center bg-[#e7eef6] p-6">
      <div
        className="w-full max-w-[400px] rounded-[22px] border border-[#dbe7f3] bg-white p-8"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-5 flex items-center gap-2.5">
          <HomeMark />
          <span className="font-[family-name:var(--font-fredoka)] text-[20px] font-semibold text-[#16324f]">
            Connect TVC
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[#16324f]">
          Sign in
        </h1>
        <p className="mt-1 text-[13px] font-semibold text-[#8aa0b4]">
          For authorized coordinators and group leaders.
        </p>

        {!supabaseConfigured ? (
          <div className="mt-5 rounded-xl bg-[#fdf9ef] p-4 text-[12.5px] font-semibold leading-relaxed text-[#a9812f]">
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
              <label className="mb-1 block text-[11.5px] font-bold text-[#8aa0b4]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@church.org"
                className="w-full rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] px-3 py-2.5 text-[13px] font-semibold text-[#16324f] outline-none focus:border-[#088df9]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-bold text-[#8aa0b4]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] px-3 py-2.5 text-[13px] font-semibold text-[#16324f] outline-none focus:border-[#088df9]"
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
              className="rounded-full bg-[#088df9] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#0b7fe0] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-[11.5px] font-semibold text-[#8aa0b4]">
              Accounts are created by an administrator. Contact your coordinator
              if you need access.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
