import Link from "next/link";
import Descent from "../components/Descent";
import ProofCases from "../components/ProofCases";

const pad = "px-5 sm:px-10";

export default function Landing() {
  return (
    <main>
      <section className="hero">
        <div className="hero-bg" aria-hidden />
        <header className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between py-6 ${pad}`}>
          <Link href="/" className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>Bothy</Link>
          <nav className="flex gap-6 text-sm" aria-label="Main navigation">
            <Link href="/defense" className="underline-offset-4 hover:underline">Workspace</Link>
            <Link href="/pilot" className="underline-offset-4 hover:underline">Pilot</Link>
          </nav>
        </header>

        <div className={`${pad} pb-16 sm:pb-24`}>
          <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>Defence supply-chain exposure</p>
          <h1 className="mt-5 max-w-5xl text-[clamp(2.75rem,9vw,8rem)] font-semibold leading-[0.92] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
            Which programmes break when gallium does?
          </h1>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link href="/defense?mode=onboarding" className="coarse-target rounded-lg border-2 px-6 py-3 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}>
              Try a guided investigation
            </Link>
            <Link href="/defense/stories" className="text-sm underline underline-offset-4">See it on real events</Link>
            <Link href="/pilot" className="text-sm underline underline-offset-4">Scope a two-week pilot</Link>
            <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>Scroll to descend ↓</span>
          </div>
        </div>
      </section>

      <Descent />

      <section className="flex min-h-[80svh] flex-col justify-center py-24">
        <div className={pad}>
          <h2 className="max-w-4xl text-[clamp(2rem,5.5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>
            A dependency is a reason to investigate, not a prediction of failure.
          </h2>
          <p className="mt-6 max-w-xl text-base">
            Every claim traces to a stored row. Every gap stays visible. Every next check gets a named owner.
          </p>
          <Link href="/defense?mode=onboarding" className="coarse-target mt-8 inline-block rounded-lg border-2 px-6 py-3 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}>
            Try a guided investigation
          </Link>
        </div>
      </section>

      <section className="pb-24">
        <div className={`${pad} mb-6 flex items-end justify-between gap-4`}>
          <div>
            <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>Earlier proof cases</p>
            <p className="mt-2 text-sm">Replays on authored timelines. Demonstrations, not predictive validation.</p>
          </div>
          <span className="mono hidden text-xs sm:block" style={{ color: "var(--text-faint)" }}>Drag →</span>
        </div>
        <ProofCases />
      </section>

      <footer className={`mono flex flex-wrap justify-between gap-2 border-t py-5 text-xs ${pad}`} style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
        <span>Bothy · the evidence stays with the decision.</span>
        <span>Prototype · public/synthetic data · exports are unapproved analysis</span>
      </footer>
    </main>
  );
}
