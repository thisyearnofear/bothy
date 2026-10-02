export const metadata = { title: "Pilot — Readiness-2030 blast-radius in 2 weeks" };

import Link from "next/link";
import { PilotInterestForm } from "../../components/EyPilotBand";

const card = { borderColor: "var(--rule)", background: "var(--panel)" } as const;

export default function PilotPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Bothy pilot one-pager</p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-strong)" }}>
        Blast radius, in milliseconds. Audit included.
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
        Problem: a single tier-3 mineral, subsidiary, or strait transit can stall a programme — and the
        exposure hides across BOMs, ownership graphs, and shipment logs. Bothy runs the blast query live
        on your graph and hands you the witness-pack.
      </p>

      <section className="mt-6 grid gap-2" aria-label="Scenario teasers">
        {[
          { t: "Loitering munition — 8-hop BOM", m: "25ms", d: "Full platform-to-mineral blast on the 764k-edge graph." },
          { t: "Primary gallium dependency", m: "8ms", d: "Which platforms stop when one material is constrained." },
          { t: "Primes behind the Taiwan Strait", m: "4ms", d: "Final assembly downstream of a single chokepoint." },
        ].map((s) => (
          <div key={s.t} className="rounded-lg border p-3" style={card}>
            <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>{s.t} · <span className="mono">{s.m}</span></p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-body)" }}>{s.d} Measured on 764k-edge graph.</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-lg border p-3" style={card} aria-label="Deployment">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Deployment</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>Laptop or DIL (disconnected, intermittent, limited). No data leaves your cell.</p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Pricing">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Pricing (indicative)</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>Pilot €15k / 2 weeks · Cell €60k / yr. Indicative — scoped on lanes + BOM size.</p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Diligence">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Paste into your proposal</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>
          Deployment: software-only, laptop or HQ server, DIL-tolerant. Data handling: buyer data never
          leaves the cell; demo pack fully synthetic. Licenses: pack graphs MIT / Apache-2.0 / WRI CC-BY-4.0
          (attribution); Bothy code per repo LICENSE. Export control: synthetic pack data; pilot scoped with
          your compliance team. Audit: every run exports a hash-linked witness-pack; approvals logged.
        </p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="GTM">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>GTM motion</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>Pipeline tracker: JSEC log cell → prime → TSO. [pipeline tracker placeholder]</p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Contact">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Contact</p>
        <PilotInterestForm />
        <p className="mono mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Prefer lanes over forms? <Link href="/digest" className="underline" style={{ color: "var(--cursor)" }}>Watch a lane on the digest wall →</Link>
        </p>
        <Link href="/watch" className="mono mt-2 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← back to watch room</Link>
      </section>
    </main>
  );
}
