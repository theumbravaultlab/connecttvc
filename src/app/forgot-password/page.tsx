"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { HomeMark } from "@/components/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Shown regardless of whether the email actually exists in the system —
  // never confirm/deny an address is a real account to an unauthenticated
  // visitor, same reasoning most auth providers follow.
  const [sent, setSent] = useState(false);

  const sendReset = async () => {
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // A malformed email address is worth surfacing (the request never
    // even reached Supabase); anything else stays generic so a failed
    // send can't be used to enumerate real accounts either.
    if (error && error.status === 400) {
      setError("Enter a valid email address.");
      return;
    }
    setSent(true);
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
          Reset your password
        </h1>

        {!supabaseConfigured ? (
          <p className="mt-5 rounded-xl bg-[var(--amber-bg)] p-4 text-[13px] font-semibold leading-relaxed text-[var(--amber-fg)]">
            Sign-in turns on once Supabase keys are added to <code>.env.local</code>.
          </p>
        ) : sent ? (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-[13px] font-semibold leading-relaxed text-[var(--muted)]">
              If an account exists for <strong className="text-[var(--ink)]">{email}</strong>, a
              reset link is on its way — check your inbox.
            </p>
            <Link
              href="/login"
              className="text-[12.5px] font-bold text-[var(--brand-blue)] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              sendReset();
            }}
          >
            <p className="text-[13px] font-semibold text-[var(--faint)]">
              Enter your email and we&apos;ll send a link to set a new password.
            </p>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[var(--faint)]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@church.org"
                className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
              />
            </div>
            {error && (
              <p className="text-[12px] font-semibold text-[oklch(0.55_0.18_20)]">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              className="rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)] disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <Link
              href="/login"
              className="text-center text-[12.5px] font-bold text-[var(--brand-blue)] hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
