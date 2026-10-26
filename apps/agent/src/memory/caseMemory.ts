// Case memory for the defence investigation loop, built on the vendored
// Meterless H-MEM engine (src/memory/hmem). Investigations, review decisions
// and owner outcomes become durable, retrievable memories; a new exposure
// question recalls prior related work before the brief is drafted, so repeat
// enquiries start warm instead of cold. Memory is auxiliary to the audited
// path: every entry point is fail-safe so a memory fault can never break an
// audited transition or refuse a brief.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DefenseBrief, GraphRun } from "../../../../packages/shared/src/types";
import { chat, getProviders, RateLimiter } from "../agent/providers";
import { getScenarioDef } from "../graph/scenarios";
import { HMEM } from "./hmem/index.ts";

const DATA_DIR = process.env.BOTHY_DATA_DIR ?? fileURLToPath(new URL("../../data/", import.meta.url));

let instance: HMEM | null = null;

// Optional LLM extraction (BOTHY_HMEM_MINER=llm): mines durable facts through
// the configured provider chain — including the self-hosted Ollama lane —
// instead of the engine's model-free heuristic path. Failure yields "[]", so
// mining degrades to nothing rather than throwing; structured add() records
// still land regardless.
async function llmMiner(prompt: string): Promise<string> {
  for (const def of getProviders()) {
    try {
      const rl = new RateLimiter(def.burst, def.reqPerMin);
      const res = await chat(def, rl, {
        messages: [{ role: "user", content: prompt }],
        maxTokens: 600,
        temperature: 0.1,
      });
      if (res.content.trim()) return res.content;
    } catch {
      // try the next provider in the chain
    }
  }
  return "[]";
}

export function getCaseMemory(): HMEM {
  if (!instance) {
    const dir = process.env.BOTHY_HMEM_DIR ?? path.join(DATA_DIR, "hmem");
    fs.mkdirSync(dir, { recursive: true });
    instance = new HMEM({
      persistDir: dir,
      actor: "bothy-agent",
      ...(process.env.BOTHY_HMEM_MINER === "llm" ? { minerFn: llmMiner } : {}),
    });
  }
  return instance;
}

/** Test hook: drop the cached instance so the next get re-reads env/disk. */
export function resetCaseMemory() {
  instance = null;
}

const safe = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    console.warn("case-memory:", error instanceof Error ? error.message : error);
  }
};

export interface RecalledMemory {
  id: string;
  content: string;
  layer: string;
  relevance: number;
}

export interface BriefMemory {
  recalled: RecalledMemory[];
  retrievalReason: string;
  strategy: string;
}

/** Recall prior related work for a new investigation. Returns null on any fault. */
export function recallInvestigations(question: string): BriefMemory | null {
  let result: BriefMemory | null = null;
  safe(() => {
    const query = getCaseMemory().query(question, { topN: 8 });
    // Repeated investigations of the same question store near-identical
    // memories; surface distinct content, ordered by relevance.
    const seen = new Set<string>();
    const recalled = query.memories
      .filter(({ memory }) => {
        const key = memory.content.toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3)
      .map(({ memory, relevance }) => ({
        id: memory.id,
        content: memory.content,
        layer: memory.layer,
        relevance: Number(relevance.toFixed(4)),
      }));
    result = {
      recalled,
      retrievalReason: query.trace.retrievalReason,
      strategy: query.trace.strategy,
    };
  });
  return result;
}

/** Store a completed exposure investigation as case memory (post-insert). */
export function recordInvestigation(brief: DefenseBrief, run: GraphRun, runId: string): void {
  safe(() => {
    const scenario = getScenarioDef(run.scenarioId);
    const hmem = getCaseMemory();
    // Model-backed mining extracts durable facts from the captured evidence
    // when BOTHY_HMEM_MINER=llm; the structured record below lands either way.
    if (process.env.BOTHY_HMEM_MINER === "llm" && scenario) {
      void hmem
        .mine("plan_completion", `${scenario.stakes} Captured rows: ${run.rows.slice(0, 10).map((row) => JSON.stringify(row)).join("; ")}`)
        .catch((error) => console.warn("case-memory mine:", error instanceof Error ? error.message : error));
    }
    hmem.add({
      content:
        `${brief.title}: captured ${run.count} evidence rows on ${brief.createdAt.slice(0, 10)}.` +
        ` ${scenario ? `Question: ${scenario.stakes}` : ""}`,
      type: "factual",
      layer: "working",
      tags: ["defence", "investigation", `scenario:${run.scenarioId}`],
      confidence: 0.8,
      source: `defense-brief:${brief.id}`,
      provenance: {
        origin: "plan_completion",
        learnedAt: Date.now(),
        label: `investigation ${brief.id}`,
        refs: [run.graphCommit, run.queryHash].filter((v): v is string => Boolean(v)),
      },
      missionId: brief.id,
      goalRunId: runId,
    });
  });
}

/** Store a review/assignment/outcome decision (post-commit). */
export function recordDecision(brief: DefenseBrief, action: string, subject: string): void {
  safe(() => {
    getCaseMemory().add({
      content: `${brief.title}: ${action} by ${subject}.`,
      type: "factual",
      layer: "working",
      tags: ["defence", "decision", `action:${action}`],
      source: `defense-audit:${brief.id}`,
      provenance: { origin: "manual", learnedAt: Date.now(), label: action, refs: [subject] },
      missionId: brief.id,
      goalRunId: brief.runId,
    });
  });
}

/** Bounded memory/ledger status for the workspace surface. */
export function caseMemoryStatus() {
  const hmem = getCaseMemory();
  const memories = hmem.store.all();
  return {
    engine: "meterless-hmem",
    memories: memories.length,
    ledger: hmem.ledger.stats(),
    recent: memories.slice(-20).map((m) => ({
      id: m.id,
      content: m.content,
      layer: m.layer,
      tags: m.tags,
      at: new Date(m.timestamp).toISOString(),
    })),
  };
}
