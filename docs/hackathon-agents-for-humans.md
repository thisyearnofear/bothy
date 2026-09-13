# Agents for Humans — Submission Pack (Good Neighbor Agents)

> Track: **Good Neighbor Agents** — helps groups, not just one: neighborhoods,
> MRT / highways duty teams, schools, small local orgs.
> Live demo: `npm run seed && npm run dev` → web `:3000` → `/watch?case=flood`.

## 1. Text description (Devpost)

**What:** Bothy is a community-resilience agent built on the **Strands Agents SDK
(TypeScript)**. It watches fragmented public weak signals — Met Office warnings,
forecasts, road operations, traffic-speed drops, Environment Agency river gauges,
incident history — and turns them into **one specific, evidence-backed,
human-approved intervention**. Not a chatbot, not an alert feed.

**Who:** Duty teams who carry the decision: highways duty officers, mountain
rescue, parish / school / food-bank coordinators, small councils without a
control room.

**How:** A Strands `Agent` owns the loop over 8 narrow read-only tools plus one
write exit (`create_human_review`). A `BeforeToolCallEvent` provenance hook
blocks any review without timestamped cited sources. The deterministic risk
engine (`apps/agent/src/engine/risk.ts`) scores every contribution as an
`EvidenceCitation`; the Decision-Replay dashboard scrubs 00:00 → now so anyone
can see *how the score evolved*. The agent **drafts**, a named duty officer
**approves/rejects**, every decision is audit-logged. Nothing publishes alone.

**Background behavior:** runs quietly on the ledger; surfaces only when risk
crosses into `ELEVATED/HIGH` with a named actor + draft warning.

## 2. Problem / who / why (video pitch spine)

1. **Problem:** responders act on fragmented weak signals — an amber warning
   here, a closure feed there, a rescue log from years ago. Noise tools
   broadcast; autonomous tools over-promise.
2. **Who:** community duty teams (highways, MRT, EA flood wardens, schools,
   food banks) who need *where risk is building before people get stranded*.
3. **Why:** a missed closure strands families on the A66; a missed river rise
   floods the Eden Valley. Accountable agents convert hours of monitoring into
   one signed decision — with receipts.

## 3. Architecture (see `docs/architecture-diagram.md`)

Browser (Next.js `:3000`, `/watch` replay) → agent API (Express `:8787`) →
Postgres + PostGIS ledger → **Strands Agent** (8 zod tools + provenance hook,
OpenAIModel on free-first provider chain) → deterministic risk engine →
`create_human_review` → duty-officer approve/reject → audit row.

## 4. Strands usage (Technical Implementation)

- `apps/agent/src/agent/strands.ts`: `toStrandsTools()` wraps all 8 tools as
  Strands `tool({ name, inputSchema: zod, callback })`; `modelForProvider()`
  points Strands `OpenAIModel(api: chat)` at Bothy's provider chain
  (Qwen HF → Venice → OpenRouter → OpenAI-compatible → Ollama);
  `provenanceGuard()` on `BeforeToolCallEvent` enforces cited sources;
  `strandsDraft()` runs the Strands loop with per-provider trace.
- `apps/agent/src/agent/loop.ts`: Strands first, legacy `llmDraft` second,
  deterministic scripted failsafe last. Trace marks `strands:<provider>` +
  `engine:strands`.
- Scripted brain stays as the boring-failure demo failsafe (roadmap §1).

## 5. What to submit (checklist)

- [x] Public repo URL + MIT `LICENSE` (root)
- [x] README with quickstart + architecture + Strands section (todo: refresh)
- [ ] Architecture diagram image (mermaid in `docs/architecture-diagram.md` → export PNG)
- [ ] Demo video ≤5 min (script below) showing working project + problem/who/why
- [ ] AWS Builder ID
- [ ] (Optional) Live demo link — scores higher on Technical Implementation
- [ ] (Bonus) builder.aws.com post titled `Agents for Humans: …`

## 6. Demo video script (4:30)

- 0:00–0:20 Problem: winter night, fragmented signals, stranded drivers.
- 0:20–1:40 Live day replay: scrub 00:00→14:30, beats land (warning → traffic
  drop 18:40-style → closure), evidence list re-renders, map pins citations.
- 1:40–2:40 Accountable gate: Strands trace (`strands:qwen-hf` → tools →
  `create_human_review`), draft → Approve as named officer → audit line.
  "Bothy never publishes alone."
- 2:40–3:40 Generalization: `/watch?case=flood` — same ledger, EA river gauge
  above 2.0m raises Eden Valley routes before any closure.
- 3:40–4:30 Why it matters + who (duty teams, schools, food banks) + Strands
  hook as the accountability mechanism. Close: "Agents, but accountable."
