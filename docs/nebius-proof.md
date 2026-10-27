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

- [ ] Model id `TBD` confirmed in the Nebius catalogue (link/date)
- [ ] `chat()` round-trip through `apps/agent/src/agent/providers.ts` connected
      lane — no guessed SKU; require explicit `NEBIUS_MODEL`

## Measurements vs scripted baseline (fill from live runs)

| Metric | Scripted | Nebius `<model>` | Ollama nemotron-mini |
|---|---|---|---|
| Draft latency (gallium-exposure, 3 runs) | TBD | TBD | ~17s |
| Claims emitted | TBD | TBD | TBD |
| Invalid/unverifiable claims | 0 (by construction) | TBD | TBD |
| Critic flags | n/a | TBD | TBD |

## Egress disclosure

Only **captured federated rows** (the already-pinned `FederatedRun` payload)
are sent to the answering provider — never graph rows, never briefs, never
auth material. The demo rows are synthetic; on real deployments this
boundary must be contractual, not incidental. If no provider is configured
or all fail, zero egress occurs: the generator is fully local.
