"use client";

/** Load failure banner with a retry action. Extracted from
 *  app/watch/page.tsx — render only. */
export default function WatchErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded border p-2 text-sm"
      style={{ borderColor: "oklch(64% 0.21 25)", background: "oklch(64% 0.21 25 / 0.1)", color: "oklch(80% 0.06 25)" }}
    >
      <span className="min-w-0">{error}</span>
      <button
        type="button"
        onClick={onRetry}
        className="mono shrink-0 rounded border px-2.5 py-1 text-xs transition-transform active:scale-[0.96]"
        style={{ borderColor: "oklch(80% 0.06 25)", color: "oklch(80% 0.06 25)" }}
      >
        Retry
      </button>
    </div>
  );
}
