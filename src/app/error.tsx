"use client";

import { useEffect } from "react";
import { HomeMark } from "@/components/icons";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--page-bg)] p-6">
      <div
        className="w-full max-w-[440px] rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-4 flex items-center justify-center gap-2.5">
          <HomeMark />
          <span className="font-[family-name:var(--font-fredoka)] text-[19px] font-semibold text-[var(--ink)]">
            Connect TVC
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-fredoka)] text-[19px] font-semibold text-[var(--ink)]">
          Couldn&apos;t load your data
        </h1>
        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">
          {error.message || "Something went wrong talking to the database."}
        </p>
        <p className="mt-1 text-[12px] font-semibold text-[var(--faint)]">
          This usually means your session expired or there&apos;s a connection
          issue — not that your data is gone.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="mt-5 rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
