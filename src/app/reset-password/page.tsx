"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { HomeMark } from "@/components/icons";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    // The Supabase browser client parses the reset link's token from the
    // URL on load and establishes a short-lived recovery session
    // automatically — this call fails with an auth error if that link was
    // invalid, already used, or has expired, which is the only real
    // failure mode here.
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        "This reset link is invalid or has expired — request a new one from the sign-in page.",
      );
      return;
    }
    setDone(true);
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
          Set a new password
        </h1>

        {!supabaseConfigured ? (
          <p className="mt-5 rounded-xl bg-[var(--amber-bg)] p-4 text-[13px] font-semibold leading-relaxed text-[var(--amber-fg)]">
            Sign-in turns on once Supabase keys are added to <code>.env.local</code>.
          </p>
        ) : done ? (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-[13px] font-semibold leading-relaxed text-[var(--muted)]">
              Your password has been updated.
            </p>
            <button
              type="button"
              // Full reload, same as the sign-in page, so the server picks
              // up the refreshed session cookie.
              onClick={() => {
                window.location.href = "/";
              }}
              className="rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
            >
              Continue to Connect TVC
            </button>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--faint)]">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--faint)]">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
              />
            </div>
            {error && (
              <p className="text-[12px] font-semibold text-[oklch(0.55_0.18_20)]">
                {error}{" "}
                {error.includes("expired") && (
                  <Link href="/forgot-password" className="underline">
                    Request a new link
                  </Link>
                )}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)] disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
