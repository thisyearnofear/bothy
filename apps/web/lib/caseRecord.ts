import type { Assessment, EvidenceCitation, RiskLabel, RouteInfo } from "../../../packages/shared/src/types";
import { byWeight, KIND_LABEL, sourceShort } from "./derive";

const OFFICER_KEY = "bothy-duty-officer";

export function readOfficerName(): string {
  try {
    return sessionStorage.getItem(OFFICER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeOfficerName(name: string) {
  try {
    if (name.trim()) sessionStorage.setItem(OFFICER_KEY, name.trim());
  } catch {
    /* private mode */
  }
}

/** Handoff artifact — what leaves the room after a sign. */
export function formatCaseRecord(input: {
  route: RouteInfo;
  label: RiskLabel;
  score: number;
  horizonTime: string;
  citations: EvidenceCitation[];
  assessment: Assessment;
  officer?: string;
}): string {
  const top = byWeight(input.citations).slice(0, 5);
  const lines = [
    `# Bothy decision case — ${input.route.name}`,
    "",
    `- Risk: **${input.label}** ${input.score.toFixed(2)} at ${input.horizonTime}`,
    `- Actor desk: ${input.route.actor}`,
    `- Engine: ${input.assessment.engine} · confidence ${input.assessment.confidence.toFixed(2)}`,
    `- Status: **${input.assessment.status.toUpperCase()}**`,
    input.assessment.decidedAt ? `- Decided: ${input.assessment.decidedAt}` : null,
    input.officer ? `- Signed by: ${input.officer}` : null,
    input.assessment.decisionNote ? `- Note: ${input.assessment.decisionNote}` : null,
    "",
    "## Evidence (by weight)",
    ...top.map(
      (c) =>
        `- ${KIND_LABEL[c.kind]} · ${sourceShort(c.source, 40)} · ${c.contribution >= 0 ? "+" : ""}${c.contribution.toFixed(2)} — ${c.text}`
    ),
    "",
    "## Draft",
    input.assessment.draft.trim(),
    "",
    "---",
    "Bothy never publishes automatically. Recorded — pending dispatch.",
  ];
  return lines.filter((l) => l != null).join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function printCaseRecord(title: string, body: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title>` +
      `<style>body{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;padding:32px;color:#111;max-width:40rem;margin:0 auto}` +
      `pre{white-space:pre-wrap;font:13px/1.45 ui-monospace,Menlo,monospace}</style></head>` +
      `<body><pre>${escapeHtml(body)}</pre></body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
