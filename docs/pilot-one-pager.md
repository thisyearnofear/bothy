# Bothy pilot one-pager — Readiness-2030 blast radius in 2 weeks

> Status: indicative pricing, synthetic pack data. Leave-behind for EY A&D + log-cell conversations. No hype words; every figure measured or sourced.

## Problem

A single tier-3 mineral, subsidiary, or strait transit can stall a programme — and the exposure hides across BOMs, ownership graphs, and shipment logs. Readiness 2030 + the Defence Readiness Omnibus (Jun 2025) push procurement speed; speed without exposure-mapping is risk. Teams learn the blast radius after the disruption, from spreadsheets.

## Product

Bothy is the accountable intervention layer on a versioned graph: fragmented signals → one fused graph → multi-hop blast-radius reasoning → a specific, evidence-backed, human-approved intervention. The agent drafts; a duty officer approves; every decision is logged with a hash-linked witness-pack.

- **Blast radius in milliseconds**, 5–12 hops, on commodity hardware.
- **Replay / branch-to-simulate / diff** as the audit trail — `CALL db.history()`, time-travel reads, change workflow.
- **Human gate is load-bearing**: `create_human_review` is the single exit; nothing publishes alone.

## Proof (measured live, Oct 2026, 764k-edge TuringDB graph)

| Scenario | Result | Time |
|---|---|---|
| Loitering-munition platform → raw minerals (8-hop BOM) | 40 mineral pairs | ~10ms |
| Platforms depending on primary gallium (any depth) | 34 platforms | ~8ms |
| NATO-HQ firms with ultimate CHN parent | 20 pairs | ~3ms |
| Final-assembly primes downstream of Taiwan Strait | 20 primes | ~7ms |
| Sanctioned-parent facilities feeding NATO plants | 20 rows | ~7ms |
| Red Sea D01 disruption status breakdown | 3 status rows | ~11ms |
| Ukrainian plant proximity pairs (energy) | 12 pairs | ~4ms |
| High-risk shipments by supplier country | 10 countries | ~13ms |

Bench of 4 in ~265ms total. Pack data is synthetic (MIT/Apache-2.0/WRI CC-BY); your pilot runs on your lanes + BOM.

## Deployment

Software-only, no hardware. Laptop or HQ server; TuringDB embedded + Next.js + TS agent. DIL-tolerant (denied/intermittent/low-bandwidth): ingest when connected, reason locally when disconnected. No data leaves your cell. Replicate per site at ~zero marginal cost.

## Pricing (indicative)

2-week pilot **€15k** (your lanes, your BOM, your audit, witness-packs included). Cell licence **€60k/yr**. Enterprise scoped on sites + graphs. Indicative — scoped on lanes + BOM size.

## Ask

1. A 2-week pilot with one log cell (JSEC/JLSG-adjacent or national equivalent).
2. An intro to the EY A&D practice for scale-up + procurement routing (EDF / Omnibus pathways).

Contact: [pilot form in the watch room →] `/pilot` · witness-pack on every scenario run.

## Landscape

Ushahidi maps the crisis, OpenCTI investigates it, Timesketch replays it — Bothy closes the loop: versioned graph → cited draft → approved intervention.
