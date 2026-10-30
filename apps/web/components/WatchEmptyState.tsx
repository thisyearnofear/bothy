"use client";

import Link from "next/link";

/** Empty room state: no scenario answered — the agent is probably down.
 *  Extracted from app/watch/page.tsx — render only. */
export default function WatchEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid h-[60vh] place-items-center">
      <div
        className="max-w-md rounded-lg border px-6 py-5 text-center"
        style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
      >
        <p className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
          The watch room is empty.
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
          No scenario answered — is the agent running? Nothing is being watched, and nothing will be decided, until
          it returns.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border-2 px-4 py-2 text-sm font-medium transition-transform active:scale-[0.96]"
            style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
          >
            Retry the case
          </button>
          <Link
            href="/"
            transitionTypes={["nav-back"]}
            className="rounded-lg border px-4 py-2 text-sm transition-transform active:scale-[0.96]"
            style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
          >
            Back to the shelter
          </Link>
        </div>
      </div>
    </div>
  );
}
