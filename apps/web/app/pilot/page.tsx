export const metadata = { title: "Pilot — Programme-impact briefs in two weeks" };

import Link from "next/link";
import { PilotInterestForm } from "../../components/EyPilotBand";

const card = { borderColor: "var(--rule)", background: "var(--panel)" } as const;

export default function PilotPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Bothy pilot one-pager</p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-strong)" }}>
        A trusted programme-impact brief. Not another alert.
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
        For a European defence-prime supply-chain team: investigate one material or lane disruption,
        trace the programme dependencies, and keep the evidence with the decision.
        The prototype includes cited briefs, review, and owned verification with synthetic data.
        A private pilot starts by agreeing the use case, reference evidence, and identity/data boundaries;
        it is not an immediate production deployment.
      </p>

      <section className="mt-6 space-y-4" aria-label="Pilot onboarding">
        <h2 className="text-xl font-semibold">A clear route from sample to scoped pilot</h2>
        <ol className="space-y-3">
          {[
            ["1. Agree the decision", "Name one analyst, one reviewer, and one recurring material or lane exposure question. Agree what an approval authorizes."],
            ["2. Approve the evidence boundary", "Agree permitted BOM/dependency fields, source versions, programme identifiers and a reference set. Confirm hosting, access, retention, export controls, and any model egress before transfer."],
            ["3. Rehearse with your process", "Validate identity roles and case access, check dependencies and coverage gaps, and compare time to a review-ready brief with the current process."],
            ["4. Review acceptance together", "Agree targets before the pilot. Record accuracy issues, handoff completion and remaining security/reliability gaps before deciding on operational use."],
          ].map(([title, text]) => <li key={title} className="rounded-lg border p-4" style={card}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed">{text}</p></li>)}
        </ol>
        <p className="text-sm leading-relaxed">This page collects contact interest only. Do not provide sensitive BOMs, programme details, credentials, or files here. Private data transfer and customer tenancy must be designed and approved separately.</p>
        <Link href="/defense?mode=investigate&scenario=gallium-chain" className="inline-block text-sm underline">Explore the synthetic sample before scoping</Link>
      </section>

      <section className="mt-6 grid gap-2" aria-label="Scenario teasers">
        {[
          { t: "Primary gallium dependency", d: "Which programmes have a material dependency worth investigating?" },
          { t: "Taiwan Strait exposure", d: "Which assembly plants depend on shipments through this lane?" },
        ].map((s) => (
          <div key={s.t} className="rounded-lg border p-3" style={card}>
            <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>{s.t}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-body)" }}>{s.d} Public/synthetic demo data; exposure is not confirmed stoppage.</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-lg border p-3" style={card} aria-label="Deployment">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Deployment</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>Local graph analysis and evidence storage. Cloud inference is optional connected mode, not offline. Agree hosting and model egress before importing buyer data.</p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Pricing">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Pricing (indicative)</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>Pilot €15k / 2 weeks · Cell €60k / yr. Indicative — scoped on lanes + BOM size.</p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Diligence">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Pilot acceptance</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>
          One agreed BOM/lane dataset and one impact question. Measure analyst-checked dependencies,
          coverage gaps, and time to a review-ready brief against today&apos;s process.
          Require evidence versions, review ownership, and buyer-approved identity/data handling.
        </p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="GTM">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>First buyer</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>A programme/supply-chain resilience lead at a European defence prime, with one analyst as the design partner.</p>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Contact">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Contact</p>
        <PilotInterestForm />
        <p className="mt-3 text-sm">An expression of interest is not a signed pilot, secure data-transfer agreement, or deployment commitment.</p>
        <Link href="/defense" className="mono mt-2 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← open the defence workspace</Link>
      </section>
    </main>
  );
}
