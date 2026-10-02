# Alignment brief

> Historical document: this is the brief Bothy was built against for the Kiro
> Ready, Spec, Ship hackathon (completed Aug 2026). The challenge mapping and
> guardrails still describe the product contract; for forward-looking direction
> see [roadmap.md](roadmap.md). For the TuringDB defense-graph adaptation plan
> see [hackathon-turingdb-defense.md](hackathon-turingdb-defense.md).

## Problem

Crisis/community responders act on fragmented public weak signals — a Met Office
amber warning here, a road-closure feed there, a mountain-rescue log from years
ago. Individually these mean little; combined they are an emerging emergency.
Traditional tools either broadcast noise (weather apps, alerts) or over-promise
(autonomous prediction). Bothy sits in the accountable middle: **it turns weak
signals into a specific, evidence-backed, human-approved intervention.**

## Challenge mapping

| Event challenge | How Bothy addresses it |
|-----------------|------------------------|
| **Trusted information** — verification is broken | Every number is traceable to a **cited source + timestamp** with confidence/uncertainty stated; full audit trail; **no autonomous publishing**. This is a counter-position to "AI makes things up." |
| **Search and rescue** — coordination, slow detection | Pre-incident exposure intelligence: the agent flags *where* risk is building **before** people get stranded, and names the responsible actor (highways duty officer, accommodation network). |
| Humanitarian logistics *(adjacent)* | Route-risk + last-mile access visibility generalizes beyond winter roads. |

## What the demo must prove (5 mins)

1. **Multi-source synthesis** — warning + forecast + road + incident combine
   coherently, each sourced and weighted. Live Open-Meteo is visible as frozen
   context and stays off the score. News on the A66 case is a sourced outcome
   beyond the hatch, not a crawl. Audio / radio / social are not in this build.
2. **Geographic reasoning** — route-specific, not a regional blanket.
3. **Legible cause** — a non-technical judge can read the causal chain.
4. **Realistic action** — correct actor + draft warning.
5. **Full loop** — detect → assess → draft → approve → record.

**Differentiator:** a drag-the-timeline bar showing *how the risk score evolved*
as signals arrived (warning issued → temp dropped → closure → history match),
with the evidence list re-rendering at each point in time. Risk is a story, not a
static number.

## Guardrails

- Not a dispatch app (crowded: GoodSAM/SARCALL).
- Not a weather app, not an autonomous emergency contact.
- The agent **drafts**; a duty officer **approves**; every decision **logged**.
  Output is a decision-support draft, never an action.

## TuringDB defense alignment (forward plan)

Full plan in [hackathon-turingdb-defense.md](hackathon-turingdb-defense.md).
Track 4 brief: multi-hop connected reasoning at speed + versioning
(replay / branch-to-simulate / diff), multi-source fusion, location + time as
queryable properties, usable by an operator/agent.

| Brief ask | Bothy evidence today | Defense adaptation |
|---|---|---|
| Multi-hop: what breaks if this node falls | 1-hop route scoring only | TuringDB Cypher blast radius (`DEPENDS_ON*`, supplier→part→site) via a `get_blast_radius` tool |
| Versioning | Timeline scrubber, 30-min `risk_snapshots`, A66 backtest | Commit per tick; replay at `T`; branch simulate; diff commits |
| Fusion | 5 signal kinds, one ledger | Same ledger as graph + `logistics_risk` (primary) or `power_plants` wedge |
| Geo + time | PostGIS `geom` + `at` | `lat/lng/at` on nodes/edges; `NEAR` edges; time-bounded Cypher |
| Operator use | Approve/reject gate, audit log | Gate unchanged — the defense auditability story |

Defense track status (Oct 2026, venue floor): the TuringDB layer is **built and
live** — 8-scenario catalogue, blast/replay tools in the agent loop,
simulate/diff, hash-chained witness-packs with public share links, no-DB digest
loop, pilot funnel + one-pager. Full log in
[hackathon-turingdb-defense.md](hackathon-turingdb-defense.md) § "What shipped".

Primary wedge: supply-route resilience. Energy second. Cyber/POLE/drone out of
scope per the intake contract.