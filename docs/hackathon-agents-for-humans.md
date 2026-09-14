# Agents for Humans — Submission Pack (Good Neighbor Agents)

> Track: **Good Neighbor Agents** — helps groups, not just one: neighborhoods,
> MRT / highways duty teams, schools, small local orgs.
> Live demo: `npm run seed && npm run dev` → web `:3000` → `/watch?case=flood`.
>
> **What makes us win vs ~9k entries:** the room *behaves* like the brief
> ("runs quietly, surfaces only on a real decision"). Scrub the A66 tape to
> dawn and the room **rests**; play the day and **watch it wake** as signals
> land — no other entry demos restraint as a feature. Every shareable
> `/case/:id` page speaks the same voice and leads with a computed impact
> number ("flagged 14h 40m before it happened").

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

## 7. Watch-my-road — users before the deadline

The brief is "runs in background, pings only on real decisions." The watch
room turned viewers into users:

- `subscriptions` + `notifications` tables (`schema.sql`) — AgentCore **Memory**
  pattern: durable per-community preferences the agent reads before notifying.
- After `create_human_review` labels `ELEVATED/HIGH`, `loop.ts` queues
  notifications for subscribers on that route (`notify:queued` trace entry).
- `POST /api/subscriptions` (one email input per route, rendered by the
  `WatchMyRoad` component in the watch room), `GET /api/subscriptions` (count
  for the video), `POST /api/digest/send` (Resend free tier, or log-only in dev).
- Shareable `/case/:id` pages forward the exact evidence + draft a stakeholder
  must sign — the Good Neighbor forwarding loop.
- **Live demo:** every bar/button works against the deployed agent, so a judge
  or a Cumbria parish clerk can sign up and receive a real digest.

## 5. What to submit (checklist)

- [x] Public repo URL + MIT `LICENSE` (root)
- [x] README with quickstart + architecture + Strands section
- [ ] Architecture diagram image (mermaid in `docs/architecture-diagram.md` → export PNG)
- [ ] Demo video ≤5 min (script below) showing working project + problem/who/why
- [ ] AWS Builder ID
- [x] (Optional) Live demo — **deploy the new build**: on the VPS
      `docker compose -f deploy/docker-compose.vps.yml up -d --build`, verify
      `api.bothy.trustfall.xyz/api/health`, then set `RESEND_API_KEY` +
      `DIGEST_TOKEN` + `PUBLIC_APP_URL` in `deploy/.env.production` and refresh
      a weather snapshot before rehearsal.
- [ ] (Bonus) builder.aws.com post titled `Agents for Humans: …`

## 6. Demo video — shot list (4:30, hard cap 5:00)

Record at 1440p, browser 100%, dark UI as-is. No face on camera — screen +
voiceover only. Every number below is **live from the API**, re-check with the
commands in §6.1 before you press record. Pitch must cover the three judging
anchors: **(1) the problem · (2) who it's for · (3) why it matters** — each is
marked in the beats.

| # | Time | Shot (what's on screen) | Say (verbatim-ish) |
|---|------|------------------------|--------------------|
| 0 | 0:00–0:25 | Landing hero: "The agent watches the hill. The human owns the call." + two doors | **Problem (1):** "Every winter, duty teams watch the same signals — a Met Office amber here, a closure feed there, a rescue log from years ago — and still get surprised. Noise tools broadcast; autonomous tools over-promise. Bothy sits in the accountable middle." |
| 1 | 0:25–1:15 | `/watch?replay=1` — scrub to **dawn: room RESTS** ("all quiet · watching 3 corridors"). Press play; beats land in order — 04:00 YELLOW warning → 09:00 18cm forecast → 19:00 speeds fell 70% → 19:30 drifting closure. Map pins land, evidence list re-renders, score climbs MODERATE → ELEVATED → HIGH 0.97 | "Scrub to dawn: nothing is a decision, so the room rests — the agent runs quietly, like the brief asks. Press play and watch it wake. Every number is a cited source with a timestamp. Nobody gets pinged until a call is real." |
| 2 | 1:15–2:10 | Horizon: A66 HIGH 0.97, 6 citations. Strands trace (`strands:*` → 8 tools → `create_human_review`), then type a duty-officer name, **Approve** → audit receipt line. Show the `provenanceGuard` line in `strands.ts` (~10s) | "The agent drafts; a named officer signs — nothing publishes alone. The Strands hook literally blocks any review without cited sources." |
| 3 | 2:10–2:55 | Watch-my-road: subscribe an email to the A66 (show **count ticking up**), run the HIGH assessment, open the auto-queued notification, then the shareable `/case/a-…` page reading **"flagged 14h 40m before it happened"** + "needs a hand" | **Who (2):** "This is for the parish clerk, the school office, the food bank — one email input, pinged only on a real decision, forwardable as a signed case. This turns viewers into users." |
| 4 | 2:55–3:50 | `/watch?case=flood` — Eden Valley: EA river gauge crosses 2.0m, flood warning, road closure. Same ledger, same scrubber, same gate. No new contract | "Same agent, different wedge — EA river gauges instead of snow. One pipeline generalizes to any weak-signals problem. That's the Good Neighbor story." |
| 5 | 3:50–4:30 | Close on the resting live desk + the intake legend strip. Final line on screen: "Agents, but accountable." | **Why (3):** "A missed closure strands families on the A66; a missed river rise floods the valley. Hours of monitoring become one signed decision — with receipts. Agents, but accountable." |

### 6.1 Pre-record verification (run these, paste the numbers into your take)

```bash
A=https://api.bothy.trustfall.xyz
curl -s $A/api/health                                        # ok:true
# Beat order on the A66 tape (expect 5 lines, HIGH 0.97 last):
curl -s "$A/api/scenario/backtest/route/r-A66/timeline" | python3 -c "..."
# Horizon ranks (expect r-A66 HIGH 0.97 at 21:30):
curl -s "$A/api/scenario/backtest/risk?at=2026-02-12T21:30:00.000Z"
# Lead time for the case page (expect 14h 40m = 09:00 cross → 23:40 outcome):
# route r-A66 first ELEVATED 09:00, outcomeAt 23:40
```

### 6.2 Recording gotchas (learned from the build)

- **Approve re-run?** Assessments are cached 30s (`force:true` in the
  `assess` POST busts it). For a clean Approve on camera, use a fresh tab or
  `force:true` — the audit receipt is the money shot, don't cut it.
- **Strands trace vs scripted:** the default `assess` uses `engine:llm`
  (Strands) only when providers are up; the demo take should show the
  `strands:qwen-hf` trace line. If the Qwen endpoint is cold, the trace falls
  through to scripted — still honest, still a working agent, but lead with the
  Strands take and keep one scripted take as backup.
- **Subscriber count is real:** whatever `GET /api/subscriptions` returns is
  your "N neighbours on watch" chip — subscribe two real addresses (yours +
  one) before recording so the chip reads ≥2 on camera.
- **Stay under 5:00:** if long, cut beat 4 (flood) to 30s — never cut the
  Approve or the problem statement; those are scored.
- **No camera needed.** Slides, screen recording, voiceover are all fine per
  the rules. Record the voiceover after the screen takes so pacing is exact.
