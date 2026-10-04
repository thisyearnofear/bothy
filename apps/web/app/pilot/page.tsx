export const metadata = { title: "Pilot — Programme-impact briefs in two weeks" };

import Link from "next/link";
import PageHero from "../../components/PageHero";
import { PilotInterestForm } from "../../components/EyPilotBand";

export default function PilotPage() {
  return (
    <main>
      <PageHero
        eyebrow="Two-week pilot"
        title="A trusted programme-impact brief. Not another alert."
        lede="One disruption, traced to the programmes it touches, with the evidence kept beside the decision."
        image="6-source"
      />
      <div className="enter mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-16">
        <section aria-label="Pilot onboarding">
          <p className="eyebrow">From sample to scoped pilot</p>
          <ol className="route mt-8">
            {[
              ["Agree the decision", "One analyst, one reviewer, one recurring exposure question. Agree what an approval authorizes."],
              ["Approve the evidence boundary", "Permitted BOM and dependency fields, source versions, a reference set. Hosting, access, retention, export controls and any model egress before transfer."],
              ["Rehearse with your process", "Validate identity roles and case access, check dependencies and coverage gaps, and compare time to a review-ready brief with today's process."],
              ["Review acceptance together", "Agree targets first. Record accuracy issues, handoff completion and remaining security gaps before deciding on operational use."],
            ].map(([title, text], index) => (
              <li key={title}>
                <span className="route-n mono" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>This page collects contact interest only. Do not provide sensitive BOMs, programme details, credentials or files here. Private data transfer and customer tenancy are designed and approved separately.</p>
          <Link href="/defense?mode=onboarding" className="mt-3 inline-block text-sm underline underline-offset-4" style={{ color: "var(--cursor)" }}>Try the guided synthetic exercise first →</Link>
        </section>

        <section className="facts mt-16" aria-label="Pilot facts">
          <div aria-label="Scenario teasers">
            <p className="mono fact-k">Questions we start from</p>
            <p><strong>Primary gallium dependency.</strong> Which programmes have a material dependency worth investigating?</p>
            <p><strong>Taiwan Strait exposure.</strong> Which assembly plants depend on shipments through this lane?</p>
            <p className="fact-note">Public/synthetic demo data. Exposure is not confirmed stoppage.</p>
          </div>
          <div aria-label="Diligence">
            <p className="mono fact-k">Acceptance</p>
            <p>One agreed BOM or lane dataset and one impact question. Measure analyst-checked dependencies, coverage gaps and time to a review-ready brief against today&apos;s process.</p>
          </div>
          <div aria-label="Deployment">
            <p className="mono fact-k">Deployment</p>
            <p>Local graph analysis and evidence storage. Cloud inference is optional connected mode, not offline. Agree hosting and model egress before importing buyer data.</p>
          </div>
          <div aria-label="Pricing">
            <p className="mono fact-k">Pricing (indicative)</p>
            <p>Pilot €15k for 2 weeks · Cell €60k per year. Scoped on lanes and BOM size.</p>
          </div>
          <div aria-label="GTM">
            <p className="mono fact-k">First buyer</p>
            <p>A programme or supply-chain resilience lead at a European defence prime, with one analyst as design partner.</p>
          </div>
        </section>

        <section className="mt-16 border-t pt-8" style={{ borderColor: "var(--rule)" }} aria-label="Contact">
          <h2 className="text-[clamp(1.5rem,3.2vw,2.25rem)] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-strong)" }}>Request a pilot</h2>
          <PilotInterestForm />
          <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>An expression of interest is not a signed pilot, data-transfer agreement or deployment commitment.</p>
          <Link href="/defense" className="mono mt-3 inline-block text-xs underline underline-offset-4" style={{ color: "var(--cursor)" }}>← open the defence workspace</Link>
        </section>
      </div>
    </main>
  );
}
