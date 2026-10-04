import Link from "next/link";
import Descent from "../components/Descent";
import ProofCases from "../components/ProofCases";
import HeroClock from "../components/HeroClock";
import BriefSpecimen from "../components/BriefSpecimen";
import WorkflowStrip from "../components/WorkflowStrip";

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
          <p className="docref">BTH-SITREP · Defence supply-chain exposure · Open source</p>
          <h1 className="mt-5 max-w-5xl text-[clamp(2.75rem,9vw,8rem)] font-semibold leading-[0.92] tracking-[-0.06em]" style={{ color: "var(--text-strong)" }}>
            Which programmes break when gallium does?
          </h1>
          <HeroClock />
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link href="/defense?mode=onboarding" className="btn btn-primary">Open a guided investigation</Link>
            <Link href="/defense/stories" className="btn">Read the case files</Link>
            <Link href="/pilot" className="text-sm underline underline-offset-4">Scope a two-week pilot</Link>
            <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>Scroll to descend ↓</span>
          </div>
        </div>
      </section>

      <Descent />

      <section className={`${pad} py-24`} aria-label="Briefing">
        <h2 className="eyebrow mb-6">From dependency to a named check</h2>
        <BriefSpecimen />
        <div className="mt-10"><WorkflowStrip /></div>
        <details className="disclosure mt-6">
          <summary>What keeps the decision accountable?</summary>
          <p>A reviewer cannot approve their own analysis. The assigned owner reports against a due date. Decisions and findings stay in a hash-chained audit record.</p>
          <p>The chain detects edits to entries, not an attacker rewriting the whole chain. Hash linkage is not an authenticated signature.</p>
        </details>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/defense/demo" className="btn btn-primary">Watch the gallium case play out</Link>
          <Link href="/pilot" className="btn">Scope a two-week pilot</Link>
        </div>
      </section>

      <section className="pb-24">
        <div className={`${pad} mb-6 flex items-end justify-between gap-4`}>
          <div>
            <p className="docref">Annex · Earlier proof cases</p>
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
