export const metadata = { title: "Pilot — Programme-impact briefs in two weeks" };

import Link from "next/link";
import PageHero from "../../components/PageHero";
import { PilotInterestForm } from "../../components/EyPilotBand";
import BriefSpecimen from "../../components/BriefSpecimen";

const GATES = [
  ["Scope", "One question. One analyst. One reviewer.", "Agree the recurring exposure question and what an approval authorizes."],
  ["Boundary", "Approved fields, access and egress.", "Agree BOM and dependency fields, source versions, reference evidence, hosting, identity, retention, export controls and any model egress before transfer. Private access and customer tenancy need separate approval."],
  ["Rehearsal", "Checked dependencies and coverage gaps.", "Validate roles and case access. Compare dependencies, interpretation errors and time to a review-ready brief against today's process."],
  ["Acceptance", "Review the results. Proceed or stop.", "Agree targets first. Review accuracy issues, handoff completion and remaining security gaps before deciding on operational use."],
] as const;

export default function PilotPage() {
  return (
    <main>
      <PageHero
        eyebrow="Two-week pilot"
        title="One question. Two weeks."
        lede="A review-ready brief for programme and supply-chain resilience teams."
        image="6-source"
      />
      <div className="enter mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-16">
        <dl className="mission-metrics" aria-label="Pilot scope">
          {[["14", "days"], ["1", "dataset"], ["1", "question"], ["€15k", "indicative pilot fee"]].map(([value, label]) => <div key={label}><dt className="readout-label">{label}</dt><dd className="readout">{value}</dd></div>)}
        </dl>
        <div className="my-8 flex flex-wrap gap-3">
          <a className="btn btn-primary" href="#contact">Discuss a pilot</a>
          <Link className="btn" href="/defense?mode=onboarding">Try the synthetic exercise</Link>
        </div>

        <BriefSpecimen />

        <section className="mt-14" aria-labelledby="pilot-gates">
          <h2 id="pilot-gates" className="eyebrow">Four gates. No automatic deployment.</h2>
          <ol className="mission-gates mt-5">
            {GATES.map(([title, output, detail], index) => <li key={title}>
              <span className="docref">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3><p>{output}</p>
              <details className="disclosure"><summary>Requirements</summary><p>{detail}</p></details>
            </li>)}
          </ol>
        </section>

        <section className="mt-14" aria-labelledby="pilot-boundary">
          <h2 id="pilot-boundary" className="eyebrow">Agree the boundary before data transfer</h2>
          <div className="boundary-strip mt-5">
            <div><strong>Local</strong><span>Graph analysis + evidence storage</span></div>
            <div><strong>Optional cloud inference</strong><span>Connected mode · approved model egress</span></div>
          </div>
          <p className="hint mt-3">Proposed pilot architecture, not a claim that this hosted demo is offline.</p>
          <h3 className="docref mt-8">Measures to agree, not achieved results</h3>
          <ul className="measure-list mt-3">
            {["Dependency accuracy", "Coverage gaps", "Time to review-ready brief", "Handoff completion"].map((measure) => <li key={measure}>{measure}</li>)}
          </ul>
          <details className="disclosure mt-6">
            <summary>Example questions &amp; commercial details</summary>
            <ul><li>Gallium: which programmes have a material dependency worth checking?</li><li>Taiwan Strait: which assembly plants depend on shipments through the lane?</li></ul>
            <p>Demo evidence is public/synthetic. Exposure is not confirmed stoppage.</p>
            <p>Indicative: pilot €15k / two weeks; Cell €60k / year. Scope depends on lanes and BOM size.</p>
          </details>
        </section>

        <section id="contact" className="mt-14 border-t pt-8" style={{ borderColor: "var(--rule)" }} aria-label="Contact">
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>Discuss your question</h2>
          <p className="hint mt-3">Contact details only. Do not submit sensitive BOMs, programme details, credentials or files.</p>
          <PilotInterestForm />
          <p className="hint mt-4">An enquiry is not a signed pilot, data-transfer agreement or deployment commitment.</p>
          <Link href="/defense" className="mono mt-3 inline-block text-xs underline underline-offset-4" style={{ color: "var(--cursor)" }}>← open the defence workspace</Link>
        </section>
      </div>
    </main>
  );
}
