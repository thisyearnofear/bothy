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
    href: "/watch?case=backtest",
    tapeHref: "/watch?replay=1",
  },
  {
    id: "live",
    name: "Lake District",
    short: "Lakes",
    kind: "operator view",
    place: "Borrowdale · Wasdale · Coniston",
    blurb: "Four corridors, one morning. Rank and sign — Open-Meteo is frozen context, not evidence.",
    href: "/watch?case=live",
  },
];

export function caseFromSearch(search: string): { id: CaseId; tape: boolean } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (q.get("replay") === "1") return { id: "backtest", tape: true };
  const raw = q.get("case");
  if (raw === "live" || raw === "backtest") return { id: raw, tape: false };
  return { id: "live", tape: false };
}

export function caseDef(id: CaseId): CaseDef {
  return CASES.find((c) => c.id === id) ?? CASES[1];
}

export function caseUrl(id: CaseId, tape: boolean, currentSearch = ""): string {
  const q = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  q.set("case", id);
  if (tape) q.set("replay", "1");
  else q.delete("replay");
  const qs = q.toString();
  return qs ? `/watch?${qs}` : "/watch";
}
