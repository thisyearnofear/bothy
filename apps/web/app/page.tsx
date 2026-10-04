import Link from "next/link";
import Descent from "../components/Descent";
import ProofCases from "../components/ProofCases";
import HeroClock from "../components/HeroClock";

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
        <p className="docref">Bottom line up front</p>
        <div className="bluf mt-4">
          <p className="bluf-tag">BLUF</p>
          <p>A dependency is a reason to investigate, not a prediction of failure. Bothy keeps the claim, the evidence, the reviewer and the owner in one record that anyone can re-check later.</p>
        </div>

        <dl className="mt-14 grid gap-4 sm:grid-cols-3">
          {[["5", "stations a case passes through, from analyst to accepted finding"], ["4", "ways to cheat the desk, each refused and logged"], ["1", "hash-chained audit log that names the first altered entry"]].map(([n, label]) => <div key={label} className="frame p-5">
            <dd className="readout">{n}</dd>
            <dt className="readout-label mt-2">{label}</dt>
          </div>)}
        </dl>

        <h2 className="docref mt-20">Chain of custody</h2>
        <table className="rule-table mt-4 max-w-4xl">
          <thead><tr><th scope="col">Stage</th><th scope="col">Who</th><th scope="col">What the record holds</th></tr></thead>
          <tbody>
            <tr><td>1 Draft</td><td>Analyst</td><td>A brief whose every claim cites a stored row. Gaps stay visible.</td></tr>
            <tr><td>2 Approve</td><td>Reviewer</td><td>A named decision, a note and a timestamp. The analyst cannot approve their own brief.</td></tr>
            <tr><td>3 Assign</td><td>Reviewer</td><td>One owner and a due date for the next check.</td></tr>
            <tr><td>4 Report</td><td>Owner</td><td>The owner acknowledges and reports. No one else can.</td></tr>
            <tr><td>5 Accept</td><td>Reviewer</td><td>The finding closes as a verification, not a proven operational effect.</td></tr>
          </tbody>
        </table>
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
