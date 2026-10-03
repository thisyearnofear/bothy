import Link from "next/link";
import CaseList from "../components/CaseList";

const rule = { borderColor: "var(--rule)" } as const;

export default function Landing() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={rule}>
        <Link href="/" className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>Bothy</Link>
        <nav className="flex gap-5 text-sm" aria-label="Main navigation">
          <Link href="/defense" className="underline">Defence workspace</Link>
          <Link href="/pilot" className="underline">Pilot</Link>
        </nav>
      </header>

      <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="mono text-xs uppercase tracking-[0.18em]" style={{ color: "var(--cursor)" }}>Accountable programme-impact briefs</p>
          <h1 className="mt-5 text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>
            The disruption is local.<br />The impact isn’t.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed">
            For defence supply-chain teams: trace a material, supplier, or transit dependency
            into programme exposure, and keep the evidence with the decision.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/defense" className="coarse-target rounded-lg border-2 px-5 py-3 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}>Open the resilience workspace</Link>
            <Link href="/pilot" className="coarse-target rounded-lg border px-5 py-3 text-sm" style={rule}>Scope a two-week pilot</Link>
          </div>
          <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Prototype · public/synthetic demo data · exports are unapproved analysis.
          </p>
        </div>
        <aside className="rounded-lg border p-6 sm:p-8" style={{ ...rule, background: "var(--panel)" }} aria-label="Product workflow">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>The case, not another alert</p>
          <ol className="mt-6 space-y-6">
            {[
              ["01", "Trace the exposure", "Which programmes depend on the disrupted material or lane?"],
              ["02", "Keep the evidence", "Inspect the query and captured result. Make missing coverage explicit."],
              ["03", "Own the decision", "Review, assignment, and recorded outcomes are implemented in the prototype. Buyer identity and operational validation remain pending."],
            ].map(([number, title, text]) => (
              <li key={number} className="flex gap-4 border-t pt-4" style={rule}>
                <span className="mono text-sm" style={{ color: "var(--cursor)" }}>{number}</span>
                <div><h2 className="font-medium" style={{ color: "var(--text-strong)" }}>{title}</h2><p className="mt-1 text-sm leading-relaxed">{text}</p></div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="border-t py-10" style={rule}>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Built for a useful decision</p>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>A dependency is a reason to investigate, not a prediction of failure.</h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed">Bothy makes the graph inspectable and the evidence portable. Inventory, substitutes, timing, and analyst review determine what the exposure means. The pilot measures time to a trusted brief, not just query speed.</p>
      </section>

      <section className="border-t py-10" style={rule}>
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>Earlier proof cases</h2>
        <p className="mt-2 text-sm">Winter roads and floods established the replay-and-evidence approach. Their modeled timelines are demonstrations, not predictive validation.</p>
        <CaseList />
      </section>
      <footer className="mono border-t pt-5 text-xs" style={{ ...rule, color: "var(--text-faint)" }}>Bothy · the evidence stays with the decision.</footer>
    </main>
  );
}
