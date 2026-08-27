import type { ScenarioId } from "../../../packages/shared/src/types";

/** Authored cases only — never generated. Same watch room, different hill. */
export type CaseId = ScenarioId;

/** Sourced A66 outcome — reported fact, not agent evidence. */
export const A66_OUTCOME_SOURCE = {
  name: "ITV News",
  date: "13 Feb 2026",
  url: "https://www.itv.com/news/border/2026-02-13/a66-in-cumbria-closed-in-both-directions-due-to-heavy-snow",
} as const;

export type CaseDef = {
  id: CaseId;
  name: string;
  short: string;
  kind: string;
  place: string;
  blurb: string;
  href: string;
  tapeHref?: string;
};

export const CASES: CaseDef[] = [
  {
    id: "backtest",
    name: "A66 Brough–Bowes",
    short: "A66",
    kind: "illustrative replay",
    place: "Stainmore",
    blurb: "ITV reported the snow closure. Rewind modeled signals up to the hatch — hindsight stays out of the draft.",
    href: "/watch?replay=1",
    tapeHref: "/watch?replay=1",
  },
  {
    id: "flood",
    name: "Eden Valley flood",
    short: "Flood",
    kind: "generalization proof",
    place: "Appleby · Osmotherley",
    blurb: "Same ledger, different wedge. Environment Agency river gauges → flood warning → road closure. The pipeline generalizes.",
    href: "/watch?case=flood",
  },
  {
    id: "live",
    name: "Lake District",
    short: "Lakes",
    kind: "operator view",
    place: "Borrowdale · Wasdale · Coniston",
    blurb: "The shift tool — same room, today's clock. Open after you sign the A66, or from the desk.",
    href: "/watch?case=live",
  },
];

export function caseFromSearch(search: string): { id: CaseId; tape: boolean; tMs?: number } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawT = q.get("t");
  const parsed = rawT != null && rawT !== "" ? Number(rawT) : NaN;
  const tMs = Number.isFinite(parsed) ? parsed : undefined;
  if (q.get("replay") === "1") return { id: "backtest", tape: true, tMs };
  const raw = q.get("case");
  if (raw === "live" || raw === "backtest" || raw === "flood") return { id: raw, tape: false, tMs };
  return { id: "live", tape: false, tMs };
}

export function caseDef(id: CaseId): CaseDef {
  return CASES.find((c) => c.id === id) ?? CASES[1];
}

export function caseUrl(id: CaseId, tape: boolean, tMs?: number) {
  const q = new URLSearchParams();
  q.set("case", id);
  if (tape) q.set("replay", "1");
  if (tMs != null && Number.isFinite(tMs)) q.set("t", String(Math.round(tMs)));
  return `/watch?${q.toString()}`;
}
