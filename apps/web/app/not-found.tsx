import Link from "next/link";

// The 404 keeps the brand promise: cold, quiet, on-thesis. A bothy that isn't
// there is still a bothy-shaped absence.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        both·y &nbsp;/ˈbɒθi/&nbsp; n. Scottish
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: "var(--text-strong)" }}>
        This bothy is dark.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
        The shelter isn&apos;t on this hill — the map has it somewhere else. No signals were recorded here, and nothing
        was decided.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition-transform active:scale-[0.96]"
          style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
        >
          Back to the shelter
        </Link>
        <Link
          href="/watch?demo=1"
          className="rounded-lg border px-5 py-2.5 text-sm transition-transform active:scale-[0.96]"
          style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
        >
          Enter the watch room
        </Link>
      </div>
      <p className="mono mt-16 text-xs" style={{ color: "var(--text-faint)" }}>
        404 · every number on every other screen still cites a source and a timestamp
      </p>
    </main>
  );
}
