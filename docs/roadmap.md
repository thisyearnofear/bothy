# Roadmap

Post-hackathon direction, decided Aug 2026. The hackathon proved the core
thesis — fragmented weak signals → cited, timeline-shaped evidence → a
human-approved intervention. Everything below preserves the two product
invariants: **reports, not media** (every source lands as a timestamped
`SignalEvent` with a named source and signed contribution — see the intake
contract in [architecture.md](architecture.md)), and **the agent drafts, a
human approves**.

> **Status (this revision):** priorities 1–3 are implemented and verified.
> The candidates backlog is now scored against the intake filter below, so a
> new source earns its place by moving the score earlier or converting a
> claim into an observation — not by novelty.

## Priorities, in order

### 1. Reliability of the live LLM path ✅

The scripted brain is the failsafe, but the LLM brain is the variable. Before
any new source: exercise the full provider chain end-to-end under realistic
conditions (429s, timeouts, dead endpoints) and rehearse the scripted
fallback so a degraded demo is a *boring* failure, not a visible one.

**Implemented:**

- `GET /api/llm/health` probes every configured provider with a 1-token chat
  and reports a structured outcome per provider (`ok | rate-limited | timeout |
  http-error | network-error`), the first provider that responded, and whether
  the scripted fallback is engaged. It never throws — a dead provider is a
  reported row, not a 500.
- `POST /api/scenario/:id/assess` and `/assess/stream` accept
  `rehearseFallback: true`, which forces `engine: "llm"`, skips the provider
  chain, and runs the scripted brain with a marked trace entry — so the
  failsafe is visibly exercised even when every provider is up.
- The watch room surfaces both via a **Reliability** panel (live desk only):
  *Probe chain* hits the health endpoint; *Rehearse fallback* runs the
  failsafe assessment and shows its trace.

### 2. Prove the generalization claim ✅

The README claims the pipeline generalizes to floods and other time-evolving
weak-signal problems. Demonstrate it cheaply: an Environment Agency
river-gauge flood scenario (free API, perfectly report-shaped, drops into the
same `SignalEvent` contract). One "same ledger, different wedge" scenario
converts a claim into evidence.

**Implemented:** a `flood` scenario (Eden Valley) with three flood-prone routes.
River-gauge readings land as `forecast` events (`levelM`, `trend`), the flood
warning as a `warning` event, and road closures as `road` events — the same
four `EventKind`s the winter wedge uses. The risk engine scores a river level
above the 2.0m flood threshold on flood-prone routes before any closure is
reported. The watch room opens it as a third case ("generalization proof") and
the intake legend names the EA river gauge as the new wedge. No new event kind,
no new tool, no new contract — one new scenario.

### 3. First new signal: traffic speed / congestion drop ✅

DfT sensor data (or a TomTom/HERE-style free tier). Chosen because it is the
only candidate that moves the score **earlier**: speeds collapse on a pass
before anyone files a closure, adding a genuinely new timeline beat
("speeds fell at 18:40; closure reported 23:40") and sharpening the lead-time
story in the A66 backtest.

**Implemented:** a `traffic` `EventKind` with a `speedKph` / `dropPct` /
`normalKph` payload. The risk engine adds a `TRAFFIC_WEIGHT` contribution
(0.16 × exposure, scaled by drop depth) that fires at ≥40% speed collapse —
weighted lighter than a closure so it sharpens the lead-time story rather than
replacing the sourced report. A new read-only `get_traffic_speed` tool serves
both brains; the scripted brain calls it after road disruptions. The A66
backtest now carries a traffic beat at 18:40 (70% drop) ~5h before the reported
23:40 closure. The intake legend lists `traffic` in the score.

## Intake filter (the rubric every candidate is scored against)

A new source enters the ledger only if it clears these four criteria. Each is
scored 0–2; a candidate needs ≥5 to be worth building, and must not duplicate an
existing source's timeline beat.

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| **New timeline beat** | Echoes an existing source | Adds a corroborating beat | Adds a beat no source has (moves the score earlier) |
| **Report-shaped data** | Media / firehose / waveform | Structured but lossy | Timestamped, named-source, citable report |
| **Real free data now** | Paid / no API | Free tier, gated | Free, public, no key |
| **Corroborates-or-precedes** (not echoes) | Echoes | Corroborates | Precedes existing sources |

### Candidates backlog

Scored against the intake filter above.

| Signal | Beat | Shape | Data | Corrob. | **Total** | Why | Caveat |
|---|---|---|---|---|---|---|---|
| **Traffic speed / congestion** (§3, done) | 2 | 2 | 2 | 2 | **8** | Only candidate that moves the score earlier | — |
| Gritting / highway fleet telemetry | 2 | 2 | 1 | 2 | **7** | Turns an operator *claim* ("gritter dispatched") into an *observation* | Coverage is patchy council-by-council |
| School / workplace closure feeds | 1 | 2 | 2 | 1 | **6** | Timestamped institutional corroboration that the network is failing | Late-ish signal; cheap to add |
| Wind-driven power outages (SSEN/SPEN) | 1 | 2 | 1 | 2 | **6** | Exposure-severity proxy; pairs with the icing term | Utility API access varies |
| Mountain-rescue (BMT/MRT) callout logs | 1 | 2 | 1 | 1 | **5** | Strong SAR-challenge flavor | Sparse/irregular; historical-pattern evidence, not live signal |
| Drone reports | 2 | 1 | 0 | 2 | **5** | Verified *observed* road state; strongest single citation the ledger can hold | Storms that trigger Bothy ground most UAVs — useful before/after the peak, not at it; plus airspace/GDPR/chain-of-custody overhead. Must enter as a signed report, never footage |
| Traffic cams, social, radio | 0 | 0 | 2 | 0 | **2** | — | Media/firehose, not reports. Excluded by the intake contract; do not reopen without a verification story |

## Explicit non-goals

- **Drone/swarm autonomy** (drones or agents acting on assessments): breaks the
  single-exit-point, human-approved invariant — the product's whole thesis.
- **A sixth scored source for its own sake**: synthesis is already proven with
  four (now five, with traffic); new sources must earn their place by moving
  the score earlier or converting claims into observations.
