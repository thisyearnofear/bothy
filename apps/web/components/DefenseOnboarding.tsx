"use client";

import { useState } from "react";

const steps = [
  { role: "Analyst", title: "Explain the dependency", task: "Open the sample, run the analysis, and reveal one captured chain from platform to material.", check: "Name the platform, component and material from a stored row, and say why this is synthetic evidence, not a real BOM." },
  { role: "Reviewer", title: "Authorize a verification", task: "Inspect a citation, then approve or reject with a rationale. If approved, pick an owner and a due time.", check: "Approval authorizes the check only. Evidence version, reviewer, owner and deadline stay inspectable." },
  { role: "Owner", title: "Return a finding", task: "Sign in as the assigned owner, acknowledge the task, and record a clearly synthetic finding.", check: "Only the right owner can act. Record what is still unknown, not a real stock result." },
  { role: "Reviewer", title: "Decide what happens next", task: "Accept the finding, or require more verification as a linked, pending revision.", check: "The original finding never changes. Acceptance is not operational closure." },
] as const;

const checks = [
  "Can an analyst explain the chain and its limits without reading Cypher?",
  "Can a reviewer reach the exact stored row behind a claim?",
  "Are wrong-role actions disabled or refused?",
  "Does a failed graph request keep the existing capture?",
  "Does a second decision conflict instead of overwriting the first?",
  "Does a linked revision start pending and keep its parent finding?",
];

export default function DefenseOnboarding() {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const last = steps.length - 1;
  return (
    <div className="space-y-12">
      <section aria-label="Guided team exercise">
        <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>Synthetic exercise</p>
        <h2 className="mt-3 max-w-3xl text-[clamp(1.5rem,3.2vw,2.25rem)] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-strong)" }}>
          A gallium delay is reported. What should your team verify?
        </h2>

        <ol className="ob-track mt-10" aria-label="Exercise steps">
          {steps.map((item, index) => (
            <li key={item.title} data-state={index === step ? "on" : index < step ? "done" : "todo"}>
              <button type="button" className="coarse-target" aria-pressed={step === index} aria-label={`Step ${index + 1}: ${item.role}`} onClick={() => setStep(index)}>
                <span className="ob-node mono">{index + 1}</span>
                <span className="mono ob-role">{item.role}</span>
              </button>
            </li>
          ))}
        </ol>

        <div key={step} role="status" className="ob-stage mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="ob-num mono" aria-hidden>{String(step + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>{current.title}</h3>
            <p className="mono mt-3 text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Step {step + 1} of {steps.length} · {current.role}</p>
          </div>
          <div className="lg:pt-4">
            <p className="text-base leading-relaxed sm:text-lg" style={{ color: "var(--text-strong)" }}>{current.task}</p>
            <p className="mt-5 border-l-2 pl-4 text-sm leading-relaxed" style={{ borderColor: "var(--cursor)" }}>
              <span className="mono mr-2 text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Check</span>
              {current.check}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button className="coarse-target rounded-lg border px-4 py-2.5 text-sm disabled:opacity-40" style={{ borderColor: "var(--rule)" }} disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
          {step < last
            ? <button className="coarse-target rounded-lg border-2 px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }} onClick={() => setStep(step + 1)}>Next step →</button>
            : <a href="/pilot" className="coarse-target rounded-lg border-2 px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}>Plan your private pilot</a>}
          <a href="/defense?mode=investigate&scenario=gallium-chain" target="_blank" rel="noopener noreferrer" className="ml-auto text-sm underline underline-offset-4" style={{ color: "var(--cursor)" }}>Open the sample ↗</a>
        </div>
      </section>

      <section className="ob-notes" aria-label="Notes for your team">
        <details>
          <summary>Before you start</summary>
          <p>Analysis needs a running graph service. Saving and role handoffs need configured SSO; the local rehearsal uses fixed synthetic accounts and does not validate your identity provider. This guide does not track case state. Confirm each result in the saved case and audit.</p>
          <p>Do not enter real programme details, supplier relationships, files, credentials or buyer evidence. Private access, hosting, retention, export controls and data transfer are agreed first.</p>
        </details>
        <details>
          <summary>Try to break the assumptions</summary>
          <p>Use synthetic records in a disposable environment. These are checks to perform, not claimed results.</p>
          <ul>{checks.map((check) => <li key={check}>{check}</li>)}</ul>
        </details>
        <details>
          <summary>Would this fit your team&apos;s process?</summary>
          <p>Agree who owns the disruption question, who may approve verification, what reference evidence to compare, and what makes a finding acceptable. Measure time and interpretation errors against your current process before setting a target.</p>
        </details>
      </section>
    </div>
  );
}
