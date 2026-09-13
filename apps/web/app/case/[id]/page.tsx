import type { Metadata } from "next";
import { site } from "../../../lib/site";
import { riskColor } from "../../../../../packages/shared/src/lib";
import { firstCrossed, leadTimeLabel, ms } from "../../../lib/derive";
import type { RiskLabel, RiskSnapshot } from "../../../../../packages/shared/src/types";

export const metadata: Metadata = {
  title: "Bothy case",
  description: `Shareable evidence-backed community-risk case. ${site.description}`,
};

type CaseData = {
  id: string;
  scenario: string;
  routeId: string;
  routeName: string;
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
  awake: boolean;
  leadText?: string;
};

const AGENT = () => process.env.AGENT_URL ?? "http://localhost:8787";

const get = async <T,>(path: string): Promise<T | null> => {
  try {
    const res = await fetch(`${AGENT()}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

async function getCase(id: string): Promise<CaseData | null> {
  const a = await get<{
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
  }>(`/api/assessments/${id}`);
  if (!a) return null;

  const sc = await get<{ scenario: { start: string; outcomeAt?: string; outcome?: string; title: string }; routes: { id: string; name: string }[] }>(
    `/api/scenario/${a.scenario}`
  );
  const routeName = sc?.routes.find((r) => r.id === a.routeId)?.name ?? a.routeId;

  // Lead-time hero: how early this corridor first crossed ELEVATED on its own
  // tape, versus the sourced outcome. Data-true, only when an outcome exists.
  let leadText: string | undefined;
  if (sc?.scenario.outcomeAt) {
    const tape = await get<RiskSnapshot[]>(`/api/scenario/${a.scenario}/route/${a.routeId}/timeline`);
    if (tape) {
      const first = firstCrossed(tape, ms(sc.scenario.start));
      if (first && ms(first.at) <= ms(sc.scenario.outcomeAt)) {
        leadText = leadTimeLabel(first.at, sc.scenario.outcomeAt);
      }
    }
  }

  const awake = a.label === "ELEVATED" || a.label === "HIGH";
  return { ...a, routeName, awake, leadText };
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
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
        <span className="font-semibold" style={{ color: riskColor(c.label as RiskLabel) }}>
          {c.label}
        </span>{" "}
        · {c.routeName}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        {c.routeName} is {c.label}
      </h1>
      <p className="mono mt-3 text-sm" style={{ color: "var(--text-body)" }}>
        score <span className="tnum">{Number(c.score).toFixed(2)}</span> · confidence <span className="tnum">{Number(c.confidence).toFixed(2)}</span> · {c.priority} · engine {c.engine} · status {c.status}
      </p>
      {c.leadText && (
        <p className="mono mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}>
          flagged <span className="font-semibold tnum">{c.leadText}</span> before it happened
        </p>
      )}
      {c.awake ? (
        <p className="mono mt-4 text-xs uppercase tracking-wider" style={{ color: "oklch(80% 0.06 25)" }}>
          needs a hand — a real decision is on the desk
        </p>
      ) : (
        <p className="mono resting mt-4 text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          resting — not a decision yet · the agent is watching
        </p>
      )}
      <section className="mt-6 rounded-lg border p-5" style={{ borderColor: "var(--rule)" }}>
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
      <a
        href={c.awake ? "/watch?case=live" : "/watch?case=backtest"}
        className="mt-4 inline-block rounded-lg border px-5 py-2.5 text-sm underline"
        style={{ borderColor: c.awake ? "var(--text-strong)" : "var(--rule)", color: c.awake ? "var(--text-strong)" : "var(--text-body)" }}
      >
        {c.awake ? "Open the desk and sign" : "Open the watch room"}
      </a>
    </main>
  );
}
