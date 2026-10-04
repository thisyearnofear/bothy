"use client";

import { useState } from "react";
import Inspector from "./Inspector";
import LensTabs from "./LensTabs";

const LINKS = [
  ["Platform", "Identify the platform name in a captured row. Do not infer a real programme from a synthetic name."],
  ["Component", "Follow the captured relationship. Check what intermediate links the query actually returned."],
  ["Material", "Find primary gallium in that row. Inventory and qualified alternatives still need checking."],
] as const;

const steps = [
  { role: "Analyst", title: "Trace the chain", task: "Run the sample. Find one platform → component → material chain.", output: "One cited dependency", boundary: "Synthetic chain, not a real BOM", check: "Name each link from a stored row and explain what the sample cannot establish." },
  { role: "Reviewer", title: "Authorize the check", task: "Inspect a citation. Approve or reject with a rationale.", output: "Decision → owner → deadline", boundary: "Approval is for verification only", check: "If approved, assign an owner and due time. Keep the evidence version and reviewer inspectable." },
  { role: "Owner", title: "Return a finding", task: "Sign in as the assigned owner. Acknowledge and report.", output: "Finding + remaining unknowns", boundary: "Invented finding, not a stock result", check: "Only the assigned owner can act. Record a clearly synthetic finding and what remains unknown." },
  { role: "Reviewer", title: "Accept or revise", task: "Accept the finding, or request a linked pending revision.", output: "Accepted finding / new pending brief", boundary: "Acceptance ≠ operational closure", check: "Confirm that the original finding is unchanged and that a revision needs its own approval." },
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
  const [link, setLink] = useState(0);
  const current = steps[step];
  const last = steps.length - 1;
  return (
    <div className="space-y-12">
      <section aria-label="Guided team exercise">
        <p className="eyebrow">Synthetic exercise</p>
        <h2 className="mt-3 max-w-3xl text-[clamp(1.5rem,3.2vw,2.25rem)] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-strong)" }}>
          A gallium delay is reported. What should your team verify?
        </h2>
        <div className="record-status mt-4"><span>Synthetic hypothesis · not a live alert</span><span>No real programme data or files</span><span>Guide only · not a completion tracker</span></div>

        <ol className="ob-track mt-10" aria-label="Exercise steps">
          {steps.map((item, index) => (
            <li key={item.title} data-state={index === step ? "on" : "todo"}>
              <button type="button" className="coarse-target" aria-pressed={step === index} aria-label={`Step ${index + 1}: ${item.role}`} onClick={() => setStep(index)}>
                <span className="ob-node mono">{index + 1}</span>
                <span className="mono ob-role">{item.role}</span>
              </button>
            </li>
          ))}
        </ol>

        <p className="sr-only" role="status">Step {step + 1}: {current.role}, {current.title}</p>
        <div key={step} className="ob-stage mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="ob-num mono" aria-hidden>{String(step + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.04em]" style={{ color: "var(--text-strong)" }}>{current.title}</h3>
            <p className="mono mt-3 text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Step {step + 1} of {steps.length} · {current.role}</p>
          </div>
          <div className="lg:pt-4">
            <p className="text-base leading-relaxed sm:text-lg" style={{ color: "var(--text-strong)" }}>{current.task}</p>
            <dl className="specimen-record mt-5">
              <div><dt>Output</dt><dd>{current.output}</dd></div>
              <div><dt>Limit</dt><dd>{current.boundary}</dd></div>
            </dl>
            <p className="context-note mt-4"><span className="eyebrow">Check</span>{current.check}</p>
          </div>
        </div>

        {step === 0 && <section className="training-chain mt-8" aria-label="Dependency inspection practice">
          <p className="docref">Illustrative training diagram · select a link to inspect</p>
          <div className="training-links mt-4">{LINKS.map(([name], index) => <button type="button" key={name}
            aria-pressed={link === index} onClick={() => setLink(index)}><span className="docref">0{index + 1}</span><strong>{name}</strong><span aria-hidden="true">↗</span></button>)}</div>
          <p className="training-note">{LINKS[link][1]}</p>
          <p className="hint">This diagram is guidance, not captured evidence. Open the sample for the actual rows.</p>
        </section>}
        {step > 0 && <div className="handoff-object mt-8"><span className="docref">Expected record / {current.role}</span><strong>{current.output}</strong><span className="hint">Inspect the saved case to confirm it. Navigating this guide records no decision.</span></div>}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button className="coarse-target rounded-lg border px-4 py-2.5 text-sm disabled:opacity-40" style={{ borderColor: "var(--rule)" }} disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
          {step < last
            ? <button className="coarse-target rounded-lg border-2 px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }} onClick={() => setStep(step + 1)}>Next step →</button>
            : <a href="/pilot" className="coarse-target rounded-lg border-2 px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}>Plan your private pilot</a>}
          <a href="/defense?mode=investigate&scenario=gallium-chain" target="_blank" rel="noopener noreferrer" className="ml-auto text-sm underline underline-offset-4" style={{ color: "var(--cursor)" }}>Open the sample ↗</a>
        </div>
      </section>

      <section className="exercise-tools" aria-label="Notes for your team">
        <a className="challenge-door" href="/defense/lab"><span className="eyebrow">Change the question</span><strong>Can you break the handoff?</strong><span>Try the decision rules in the lab →</span></a>
        <Inspector label="Open the field guide" title="Exercise field guide">
          <LensTabs label="Field guide sections" items={[
            { id: "setup", label: "Before you start", content: <><p>Analysis needs a running graph service. Saving and role handoffs need configured SSO; the local rehearsal uses fixed synthetic accounts and does not validate your identity provider. This guide does not track case state or certify completion. Confirm each result in the saved case and audit.</p><p>Do not enter real programme details, supplier relationships, files, credentials or buyer evidence. Private access, hosting, retention, export controls and data transfer are agreed first.</p></> },
            { id: "checks", label: "Stress-test checklist", content: <><p>Use synthetic records in a disposable environment. These are checks to perform, not claimed results.</p><ul className="reference-list">{checks.map((check) => <li key={check}>{check}</li>)}</ul></> },
            { id: "fit", label: "Team fit", content: <p>Agree who owns the disruption question, who may approve verification, what reference evidence to compare, and what makes a finding acceptable. Measure time and interpretation errors against your current process before setting a target.</p> },
          ]} />
        </Inspector>
      </section>
    </div>
  );
}
