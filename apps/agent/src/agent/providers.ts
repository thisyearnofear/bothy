import { createHash } from "node:crypto";

// Multi-provider LLM chain - OpenAI-compatible clients with per-provider
// rate limiting, 429 Retry-After handling, timeouts, and a short TTL cache.
// Free-first: a public Qwen HF endpoint, OpenRouter free tier, any
// OpenAI-compatible base URL, and local Ollama. No Anthropic key required.

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ChatMsg {
  role: string;
  content: string | Array<Record<string, unknown>>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
}

export interface LlmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMsg[];
  tools?: LlmTool[];
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string;
}

export interface ToolCallOut {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCallOut[];
  reasoning?: string;
  usage?: Record<string, unknown>;
}

export class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export class RateLimitError extends ProviderError {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs = 3000) {
    super(message, 429);
    this.retryAfterMs = retryAfterMs;
  }
}

export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  reqPerMin: number;
  burst: number;
  maxTokens: number;
  timeoutMs: number;
  reasoningEffort?: string; // none|low|medium|high|xhigh
  temperature?: number;
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export class RateLimiter {
  private tokens: number;
  private last: number;
  private readonly cap: number;
  private readonly rps: number;
  constructor(burst: number, perMin: number) {
    this.cap = burst;
    this.tokens = burst;
    this.last = Date.now();
    this.rps = perMin / 60;
  }
  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.cap, this.tokens + ((now - this.last) / 1000) * this.rps);
    this.last = now;
  }
  acquire(timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    const step = (): Promise<void> => {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return Promise.resolve();
      }
      if (Date.now() - start > timeoutMs) return Promise.reject(new RateLimitError("local rate bucket empty"));
      return sleep(400).then(step);
    };
    return step();
  }
}

// --- tiny TTL cache ------------------------------------------------------------
const cache = new Map<string, { t: number; r: ChatResult }>();
const CACHE_TTL_MS = 60_000;
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 24);
const trimSlash = (s: string) => (s.endsWith("/") ? s.slice(0, -1) : s);

export interface ProviderState {
  def: ProviderDef;
  rl: RateLimiter;
}

async function openaiRaw(def: ProviderDef, req: ChatRequest): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: def.model,
    messages: req.messages,
    max_tokens: req.maxTokens ?? def.maxTokens,
    temperature: req.temperature ?? def.temperature ?? 0.7,
    stream: false,
  };
  if (req.tools && req.tools.length) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  const effort = req.reasoningEffort ?? def.reasoningEffort;
  if (effort && effort !== "none") body.reasoning_effort = effort;

  const res = await fetch(`${trimSlash(def.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(def.apiKey ? { authorization: `Bearer ${def.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(def.timeoutMs),
  });

  if (res.status === 429) {
    const ra = res.headers.get("retry-after");
    const secs = ra ? Number(ra) : Number.NaN;
    throw new RateLimitError("429 rate limited", Number.isFinite(secs) ? Math.min(secs, 30) * 1000 : 3000);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new ProviderError(`${def.id} ${res.status}: ${t.slice(0, 200)}`, res.status);
  }

  const data = (await res.json()) as any;
  const m = data.choices?.[0]?.message ?? {};
  const toolCalls: ToolCallOut[] = (m.tool_calls ?? []).map((tc: any) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
    } catch {
      args = {};
    }
    return { id: tc.id, name: tc.function?.name ?? "", args };
  });
  return { content: m.content ?? "", toolCalls, reasoning: m.reasoning, usage: data.usage };
}

// cached + rate-limited + one 429 backoff retry
export async function chat(def: ProviderDef, rl: RateLimiter, req: ChatRequest): Promise<ChatResult> {
  const key = sha(JSON.stringify({ id: def.id, model: def.model, req }));
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.r;

  await rl.acquire();
  let res: ChatResult;
  try {
    res = await openaiRaw(def, req);
  } catch (e) {
    if (e instanceof RateLimitError) {
      await sleep(Math.min(e.retryAfterMs, 4000));
      await rl.acquire();
      res = await openaiRaw(def, req);
    } else {
      throw e;
    }
  }
  cache.set(key, { t: Date.now(), r: res });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) if (now - v.t > CACHE_TTL_MS) cache.delete(k);
  }
  return res;
}

const HF_QREN_URL = "https://g9hnto0u7lvbu837.us-east-2.aws.endpoints.huggingface.cloud/v1";

function builder(e: NodeJS.ProcessEnv): ProviderDef[] {
  const out: ProviderDef[] = [];
  const put = (d: ProviderDef | null) => {
    if (d) out.push(d);
  };

  // free public Hugging Face endpoint (no key, rate-limited ~30/min)
  put({
    id: "qwen-hf",
    label: "Qwen3.8-27B (free HF endpoint)",
    baseUrl: e.QWEN_HF_URL ?? HF_QREN_URL,
    apiKey: e.QWEN_HF_KEY ?? "none",
    model: e.QWEN_HF_MODEL ?? "Qwen/Qwen3.8-27B",
    reqPerMin: num(e.QWEN_HF_RPM, 24),
    burst: num(e.QWEN_HF_BURST, 12),
    maxTokens: num(e.BOTHY_LLM_MAX_TOKENS, 1500),
    timeoutMs: num(e.BOTHY_LLM_TIMEOUT, 25_000),
    reasoningEffort: e.QWEN_REASONING ?? "low",
    temperature: 0.7,
  });

  // OpenRouter free tier (optional; requires OPENROUTER_API_KEY)
  if (e.OPENROUTER_API_KEY) {
    put({
      id: "openrouter",
      label: "OpenRouter (free tier)",
      baseUrl: e.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      apiKey: e.OPENROUTER_API_KEY,
      model: e.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free",
      reqPerMin: 20,
      burst: 6,
      maxTokens: num(e.BOTHY_LLM_MAX_TOKENS, 1500),
      timeoutMs: num(e.BOTHY_LLM_TIMEOUT, 90_000),
      temperature: 0.7,
    });
  }

  // any OpenAI-compatible server
  if (e.OPENAI_BASE_URL || e.OPENAI_API_KEY) {
    put({
      id: "openai",
      label: "OpenAI-compatible",
      baseUrl: e.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: e.OPENAI_API_KEY ?? "",
      model: e.OPENAI_MODEL ?? "gpt-4o-mini",
      reqPerMin: 30,
      burst: 15,
      maxTokens: num(e.BOTHY_LLM_MAX_TOKENS, 1500),
      timeoutMs: num(e.BOTHY_LLM_TIMEOUT, 90_000),
      temperature: 0.7,
    });
  }

  // local Ollama (opt-in: set OLLAMA_BASE_URL)
  if (e.OLLAMA_BASE_URL) {
    put({
      id: "ollama",
      label: "Ollama (local)",
      baseUrl: e.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      apiKey: "ollama",
      model: e.OLLAMA_MODEL ?? "qwen3:8b",
      reqPerMin: 60,
      burst: 30,
      maxTokens: num(e.BOTHY_LLM_MAX_TOKENS, 1500),
      timeoutMs: num(e.BOTHY_LLM_TIMEOUT, 60_000),
      temperature: 0.7,
    });
  }
  return out;
}

let cacheInfo: { at: number; defs: ProviderDef[] } | null = null;

/** Configured providers in priority order (env BOTHY_LLM_PROVIDERS). */
export function getProviders(e = process.env): ProviderDef[] {
  if (cacheInfo && Date.now() - cacheInfo.at < 10_000) return cacheInfo.defs;
  const all = builder(e);
  const order = (e.BOTHY_LLM_PROVIDERS ?? "qwen-hf,openrouter,openai,ollama").split(",").map((s) => s.trim()).filter(Boolean);
  const byId = new Map(all.map((d) => [d.id, d]));
  const sorted = order.map((id) => byId.get(id)).filter((d): d is ProviderDef => !!d);
  // keep any configured provider not mentioned in order, appended at end
  for (const d of all) if (!sorted.some((x) => x.id === d.id)) sorted.push(d);
  cacheInfo = { at: Date.now(), defs: sorted };
  return sorted;
}

export function hasProviders(): boolean {
  return getProviders().length > 0;
}

export function providerSummary(): Array<{ id: string; label: string; model: string }> {
  return getProviders().map((d) => ({ id: d.id, label: d.label, model: d.model }));
}
