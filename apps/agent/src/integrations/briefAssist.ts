// Optional model-drafted claim narrative (BOTHY_BRIEF_ASSIST=llm). The
// provider chain — including the self-hosted Nemotron/Ollama lane — writes
// the claim *text* for captured federated rows; citations stay deterministic
// and the model may phrase but never cite or invent evidence. One call per
// captured "rows" run; any provider or parse failure falls back to scripted
// text for that row, so the audited path never depends on a live model.

import { chat, getProviders, RateLimiter } from "../agent/providers";
import type { FederatedRun } from "../../../../packages/shared/src/types";

const MAX_ROWS = 3;

export interface NarrativeResult {
  model: string;
  // Parallel to the runs array: entries for "rows" runs hold up to MAX_ROWS
  // claim lines, index-aligned with the cited rows; undefined entries fall
  // back to scripted text; non-"rows" entries are empty.
  narrative: (string | undefined)[][];
}

function prompt(run: FederatedRun): string {
  const rows = run.rows.slice(0, MAX_ROWS);
  return [
    `You are drafting evidence claim lines for a supply-chain verification brief.`,
    `Source: "${run.title}" (${run.sourceBoundary})`,
    `Write exactly ${rows.length} line(s) — one per row — under 140 characters each, factual phrasing, using ONLY the field names and values given. No inference, no new facts, no assessment, no numbering, no preamble.`,
    ...rows.map((row) => JSON.stringify(row)),
  ].join("\n");
}

// A claim line only counts if it actually uses the row's data — this drops
// model preamble ("Sure, here are the claim lines...") and chatter while
// keeping alignment between line and row.
function linesForRow(lines: string[], row: Record<string, unknown>): string | undefined {
  const values = Object.values(row).map(String).filter((v) => v.length > 4);
  return lines.find((line) => values.some((v) => line.toLowerCase().includes(v.toLowerCase())));
}

export async function draftFederatedNarrative(runs: FederatedRun[]): Promise<NarrativeResult | null> {
  const targets = runs.map((run, index) => (run.kind === "rows" && run.rows.length ? index : -1)).filter((i) => i >= 0);
  if (!targets.length) return null;
  for (const def of getProviders()) {
    try {
      const rl = new RateLimiter(def.burst, def.reqPerMin);
      const narrative: (string | undefined)[][] = runs.map(() => []);
      let any = false;
      for (const index of targets) {
        const res = await chat(def, rl, {
          messages: [{ role: "user", content: prompt(runs[index]) }],
          maxTokens: 500,
          temperature: 0.2,
        });
        const lines = res.content
          .split("\n")
          .map((line) => line.trim().replace(/^[-*\d.)\s]+/, "").trim().replace(/^["']|["'],?$/g, "").trim())
          .filter((line) => line.length > 15 && line.length <= 200 && !line.includes('":'));
        narrative[index] = runs[index].rows.slice(0, MAX_ROWS).map((row) => linesForRow(lines, row));
        if (narrative[index].some(Boolean)) any = true;
      }
      if (any) return { model: `${def.id}:${def.model}`, narrative };
    } catch {
      // try the next provider in the chain
    }
  }
  return null;
}
