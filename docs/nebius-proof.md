# Nebius proof — Open Agent 2026 / NVIDIA track

Status: **skeleton — measurements pending credentials.** Fill every `TBD` from
a live run before citing. Do not submit claims measured against a stub.

## What runs on Nebius

- **Claim narrative** (`BOTHY_BRIEF_ASSIST=llm`): `apps/agent/src/integrations/briefAssist.ts`
  drafts claim *text* for captured federated rows via the provider chain.
  With `BOTHY_LLM_PROVIDERS=nebius,ollama` the Nebius lane answers first;
  `generator.assist` on the brief records `"nebius:<model-id>"` as model
  provenance — which model wrote text is part of the audit trail.
- **Faithfulness critic**: same module, `critiqueNarrative` — the model checks
  each drafted line states only facts present in its source row; FLAGged
  lines revert to the deterministic scripted rendering. Trace step:
  `critique → N checked · M flagged → scripted`.
- **Optional H-MEM mining** (`BOTHY_HMEM_MINER=llm`) routes through the same
  chain and would hit Nebius under the same provider order.

## Configuration

```
NEBIUS_API_KEY=<key>
NEBIUS_BASE_URL=<token-factory endpoint>
NEBIUS_MODEL=<verified catalogue model — TBD>
NEBIUS_TIMEOUT=30000
BOTHY_LLM_PROVIDERS=nebius,ollama
BOTHY_BRIEF_ASSIST=llm
```

Provider chain is `id`-ordered with per-provider rate limiting; failure in
any provider falls through to the next, then to the deterministic scripted
generator. The audited path (capture → hash → citation self-check → review)
is identical whichever provider answers — the model may phrase evidence,
never invent it.

## Eligible-model verification

- [x] `GET /v1/models` → 30-model catalogue, NVIDIA Nemotron family confirmed
      (27 Oct 2026): Nano-30B-A3B, Nemotron-3_5-Lightning, Super-120b,
      Ultra-550b, Super-VL
- [x] Model in use: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` — set explicitly
      via `NEBIUS_MODEL`; connected lane only, no guessed SKU
- [x] `chat()` round-trip verified live (HTTP 200, real inference)
- [x] Live draft verified: `generate → nebius:…Nano-30B-A3B drafted 11 cited
      claims`, `critique → … 3 checked · all pass`,
      `generator.assist = "nebius:nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"`

### Model quirks recorded

- Nemotron-3 is a **reasoning model**: output lands in `message.reasoning`
  first. `reasoning_effort: "low"` is set on the provider def and token
  budgets are sized so content emits (narrative 4000, critique 1500) —
  smaller budgets finish `length` with empty `content`.
- `GET /v1/fine_tuning/jobs` → **HTTP 200** — the fine-tuning API is
  available on this account (empty job list).

## Measurements vs scripted baseline (gallium-exposure draft)

| Metric | Scripted | Ollama nemotron-mini | Nebius Nano-30B-A3B |
|---|---|---|---|
| Draft latency (assist on) | ~2s | ~34s | ~62s incl. 2 reasoning calls |
| Claims emitted | 11 | 11 | 11 |
| Invalid/unverifiable claims | 0 (by construction) | 0 (row-matched + critic) | 0 (row-matched + critic) |
| Critic flags | n/a | 0/3 | 0/3 |

Latency note: Nebius calls are individually fast (~10s incl. reasoning) — the
draft's total is two sequential reasoning calls. A non-reasoning model or
parallel calls would cut this substantially; the deterministic baseline is
always available when the flag is off.

## Egress disclosure

Only **captured federated rows** (the already-pinned `FederatedRun` payload)
are sent to the answering provider — never graph rows, never briefs, never
auth material. The demo rows are synthetic; on real deployments this
boundary must be contractual, not incidental. If no provider is configured
or all fail, zero egress occurs: the generator is fully local.
