"use client";

import { useState } from "react";

const steps = [
  { role: "Analyst", title: "Explain the dependency", task: "Assume a gallium supply delay has been reported. Which modeled platforms have a dependency worth checking? Open the sample, analyze, and reveal one captured chain.", check: "Identify the platform, component, and material in a stored row. Explain why this is synthetic model evidence, not a real programme BOM or proof of stoppage." },
  { role: "Reviewer", title: "Authorize a verification", task: "Sign in with the configured reviewer role, inspect a citation, and approve or reject the brief with a rationale. If approved, choose an eligible owner and due time.", check: "Approval authorizes the verification task only. The evidence version, reviewer, owner, and deadline must remain inspectable." },
  { role: "Owner", title: "Return a finding", task: "Sign in separately as the assigned owner, reopen the saved case, acknowledge, and record a clearly synthetic finding about programme mapping, inventory, alternatives, or timing.", check: "The right owner can act; another role cannot. Record what remains unknown instead of claiming a real stock or production result." },
  { role: "Reviewer", title: "Decide what happens next", task: "Return to awaiting-review work. Accept the finding with a rationale or require further verification. For further work, create a linked pending revision and review it independently.", check: "The original finding remains unchanged. Acceptance is not operational closure; further verification does not automatically assign a task." },
];
const checks = [
  "Can an analyst explain the chain and its limitations without reading Cypher?",
  "Can a reviewer reach the exact stored row supporting a claim?",
  "Do wrong-role actions remain disabled or refused?",
  "Does a failed graph request show an error without replacing an existing capture?",
  "Does a second decision conflict rather than overwrite the first?",
  "Does a linked revision start pending and retain the parent finding?",
];

export default function DefenseOnboarding() {
  const [step, setStep] = useState(0);
  const current = steps[step];
  return <div className="space-y-6">
    <section className="rounded-xl border p-5 sm:p-7" style={{ borderColor: "var(--cursor)", background: "var(--panel)" }} aria-label="Guided team exercise">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Example onboarding · synthetic exercise</p>
      <h2 className="mt-3 text-2xl font-semibold">A gallium delay has been reported. What should your team verify?</h2>
      <p className="mt-3 text-sm leading-relaxed">This is an exercise hypothesis, not a live alert. Use the starter's invented platform and part identities to explore the workflow without uploading your company's BOM. The goal is a cited investigation, a named verification owner, and a reviewed finding.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href="/defense?mode=investigate&scenario=gallium-chain" target="_blank" rel="noopener noreferrer" className="coarse-target rounded-lg border px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}>Open sample investigation in a new tab</a>
        <a href="/pilot" className="coarse-target rounded-lg border px-4 py-3 text-sm">Plan your private pilot</a>
      </div>
      <p className="mt-3 text-sm">Analysis needs a running graph service. Saving and role handoffs require configured SSO. The local rehearsal supplies fixed synthetic accounts; it does not validate your identity provider.</p>
    </section>
    <section className="rounded-lg border p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Exercise walkthrough">
      <div className="flex flex-wrap gap-2" aria-label="Exercise steps">{steps.map((item, index) => <button key={item.title} className="coarse-target rounded-lg border px-3 py-2 text-sm" aria-pressed={step === index} style={{ borderColor: step === index ? "var(--cursor)" : "var(--rule)" }} onClick={() => setStep(index)}>{index + 1}. {item.role}</button>)}</div>
      <div role="status" className="mt-5"><p className="text-xs uppercase tracking-wide" style={{ color: "var(--cursor)" }}>Step {step + 1} of 4 · {current.role}</p><h3 className="mt-2 text-xl font-semibold">{current.title}</h3></div>
      <p className="mt-3 text-sm leading-relaxed">{current.task}</p>
      <div className="mt-4 border-l-2 pl-4" style={{ borderColor: "var(--cursor)" }}><h4 className="text-sm font-semibold">What to check</h4><p className="mt-2 text-sm leading-relaxed">{current.check}</p></div>
      <div className="mt-5 flex gap-3"><button className="coarse-target rounded border px-3 py-2 text-sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous step</button><button className="coarse-target rounded border px-3 py-2 text-sm" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>Next step</button></div>
      <p className="mt-3 text-xs">This guide does not track case state or certify completion. Confirm each result in the saved case and audit.</p>
    </section>
    <section className="rounded-lg border p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Stress-test checklist"><h2 className="text-xl font-semibold">Try to break the assumptions</h2><p className="mt-2 text-sm">Use synthetic records and a disposable environment. These are checks to perform, not claimed results.</p><ul className="mt-4 list-disc space-y-3 pl-5 text-sm">{checks.map((check) => <li key={check}>{check}</li>)}</ul></section>
    <section className="rounded-lg border p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}><h2 className="text-xl font-semibold">Would this fit your team's process?</h2><p className="mt-3 text-sm">Discuss who owns the disruption question, who may approve verification, what reference evidence you would compare, and what makes a finding acceptable. Measure time and interpretation errors against your current process before agreeing a target.</p><p className="mt-3 text-sm">Do not enter real programme details, sensitive supplier relationships, files, credentials, or buyer evidence into this sample. Private access, hosting, retention, export controls, and data transfer must be agreed first.</p><a href="/defense" className="mt-4 inline-block text-sm underline">Return to workspace</a></section>
  </div>;
}
