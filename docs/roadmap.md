# Roadmap

Post-hackathon direction, decided Aug 2026. The hackathon proved the core
thesis — fragmented weak signals → cited, timeline-shaped evidence → a
human-approved intervention. Everything below preserves the two product
invariants: **reports, not media** (every source lands as a timestamped
`SignalEvent` with a named source and signed contribution — see the intake
contract in [architecture.md](architecture.md)), and **the agent drafts, a
human approves**.

## Priorities, in order

### 1. Reliability of the live LLM path

The scripted brain is the failsafe, but the LLM brain is the variable. Before
any new source: exercise the full provider chain end-to-end under realistic
conditions (429s, timeouts, dead endpoints) and rehearse the scripted
fallback so a degraded demo is a *boring* failure, not a visible one.

### 2. Prove the generalization claim

The README claims the pipeline generalizes to floods and other time-evolving
weak-signal problems. Demonstrate it cheaply: an Environment Agency
river-gauge flood scenario (free API, perfectly report-shaped, drops into the
same `SignalEvent` contract). One "same ledger, different wedge" scenario
converts a claim into evidence.

### 3. First new signal: traffic speed / congestion drop

DfT sensor data (or a TomTom/HERE-style free tier). Chosen because it is the
only candidate that moves the score **earlier**: speeds collapse on a pass
before anyone files a closure, adding a genuinely new timeline beat
("speeds fell at 18:40; closure reported 19:15") and sharpening the lead-time
story in the A66 backtest.

### Candidates backlog

Scored against the intake filter: new timeline beat, report-shaped data,
real free data now, corroborates-or-precedes (not echoes) existing sources.

| Signal | Why | Caveat |
|---|---|---|
| Gritting / highway fleet telemetry | Turns an operator *claim* ("gritter dispatched") into an *observation* | Coverage is patchy council-by-council |
| School / workplace closure feeds | Timestamped institutional corroboration that the network is failing | Late-ish signal; cheap to add |
| Wind-driven power outages (SSEN/SPEN) | Exposure-severity proxy; pairs with the icing term | Utility API access varies |
| Mountain-rescue (BMT/MRT) callout logs | Strong SAR-challenge flavor | Sparse/irregular; historical-pattern evidence, not live signal |
| Drone reports | Verified *observed* road state; strongest single citation the ledger can hold | Storms that trigger Bothy ground most UAVs — useful before/after the peak, not at it; plus airspace/GDPR/chain-of-custody overhead. Must enter as a signed report, never footage |
| Traffic cams, social, radio | — | Media/firehose, not reports. Excluded by the intake contract; do not reopen without a verification story |

## Explicit non-goals

- **Drone/swarm autonomy** (drones or agents acting on assessments): breaks the
  single-exit-point, human-approved invariant — the product's whole thesis.
- **A sixth scored source for its own sake**: synthesis is already proven with
  four; new sources must earn their place by moving the score earlier or
  converting claims into observations.
