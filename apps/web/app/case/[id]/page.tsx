import type { Metadata } from "next";
import { site } from "../../../lib/site";

export const metadata: Metadata = {
  title: "Bothy case",
  description: `Shareable evidence-backed community-risk case. ${site.description}`,
};

async function getCase(id: string) {
  const base = process.env.AGENT_URL ?? "http://localhost:8787";
  const res = await fetch(`${base}/api/assessments/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as {
    id: string;
    scenario: string;
    routeId: string;
    at: string;
    score: number;
    label: string;
    confidence: number;
    causalChain: string[];
    draft: string;
    responsibleActor: string;
    priority: string;
    status: string;
    engine: string;
  };
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  if (!c) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold">Case not found</h1>
        <p className="mono mt-4 text-sm uppercase tracking-widest" style={{ color: "var(--text-body)" }}>
          The link may be old — open the watch room for live cases.
        </p>
        <a href="/watch?case=live" className="mt-8 inline-block rounded-lg border px-5 py-2.5 text-sm underline">
          Open the watch room
        </a>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="mono text-xs uppercase tracking-[0.22em]" style={{ color: "var(--cursor)" }}>
        Bothy case · {c.scenario} · {c.routeId}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        {c.routeId} is {c.label}
      </h1>
      <p className="mono mt-3 text-sm" style={{ color: "var(--text-body)" }}>
        score {Number(c.score).toFixed(2)} · confidence {Number(c.confidence).toFixed(2)} · {c.priority} · engine {c.engine} · status {c.status}
      </p>
      <section className="mt-8 rounded-lg border p-5" style={{ borderColor: "var(--rule)" }}>
        <h2 className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>
          Draft for duty officer — {c.responsibleActor}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{c.draft}</p>
      </section>
      <section className="mt-6">
        <h2 className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>
          Evidence ({c.causalChain.length})
        </h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed">
          {c.causalChain.map((line, i) => (
            <li key={i} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--rule)" }}>
              {line}
            </li>
          ))}
        </ol>
      </section>
      <p className="mono mt-8 text-xs uppercase tracking-widest" style={{ color: "var(--text-body)" }}>
        Bothy drafts — a named duty officer approves. Nothing publishes alone.
      </p>
      <a href="/watch?case=live" className="mt-4 inline-block rounded-lg border px-5 py-2.5 text-sm underline">
        Open the watch room
      </a>
    </main>
  );
}
