# Graph data coverage: what is actually wired

Date: 2026-10-04
POC: Bothy team lead
TL;DR: Only primary gallium is wired into the bill-of-materials chain. Germanium
and antimony exist as nodes but have no feeders and no platform chains, so a
second-material demo returns empty. Reuse is demonstrable today through a second
*question shape* on the same graph, which does return rows.

Probed read-only against the live graph `supply_chain_deep` on the venue stack
(scripts in `/tmp`, not committed; re-run before relying on any count).

## Second material: do not promise this on stage

| Target | Materials pointing at it | Full `Platform→…→Material` chain |
|---|---|---|
| `Primary gallium` | 1 | **10 rows** (limit 10; distinct platforms below) |
| `Primary germanium` | 0 | 0 rows |
| `Primary antimony` | 0 | 0 rows |

`germanium` and `antimony` do appear in the store, which is why a `grep` looks
encouraging — but they are terminal nodes with nothing upstream. Running the
gallium chain with the name substituted returns an empty result set, and the UI
correctly reports it as no exposure rather than inventing one. That is the right
behaviour and the wrong demo.

If a second material is needed for a pilot, it is a data-ingestion task against
the pack generator, not a product change. Say it that way: the workflow is
material-agnostic, the *pack* is gallium-specific.

## What gallium exposure actually contains

`MATCH (p:Platform)-[:CONTAINS]->+(:Material {name:'Primary gallium'})` → **34
distinct platform names** (query limit 50). Matches the deck's bounded-exposure
figure.

The 8-stage chain returns 10 sampled rows across six platform archetypes:

```
Infantry fighting vehicle IFV-24A        Jet-powered target drone JPTD-12A
Anti-tank guided missile ATGM-75A        FPV strike drone FSD-13A
Ground surveillance radar GSR-97A        SHORAD system SS-35A
```

through two intermediate materials: `GaAs substrate wafer` and
`GaN-on-SiC epitaxial wafer`. These are synthetic names from the sponsor's pack.

**Pitch consequence:** the spoken line can be far more concrete than "an infantry
fighting vehicle". The same data contains ground surveillance radar, SHORAD and
loitering/FPV drones — which is exactly the ISR-and-firepower exposure a defence
jury pictures. Name two of them and the point lands without overstating anything.

## Reuse that works today

Every one of these returned rows on the first attempt, and each exercises the
same reviewed-read → pinned-capture → cited-brief pipeline with a different
question shape:

| Scenario | Rows | Question shape |
|---|---|---|
| `chn-ownership` | 5+ | ownership chain terminating in CHN, from a NATO-HQ parent |
| `taiwan-chokepoint` | 5+ | shipment transit → facility → final-assembly prime |
| `sanctions-exposure` | 5+ | sanctioned ultimate owner still feeding a NATO-country plant |
| `loitering-munition-mineral` | 5+ | fixed 8-hop platform → raw `Mineral`, different label |
| `gallium-chain` | 10 | material dependency explanation |

Sample values, all synthetic: `Avior Defence Systems SAS - Lyon` (final-assembly
prime downstream of a Taiwan Strait transit); `Helion Group S.a r.l.` under
`Xinyuan Group Co., Ltd.`; `Loitering munition LM-21A` → `Copper ore`.

**Recommended reuse demo:** run `chn-ownership` or `taiwan-chokepoint` live after
the gallium chain. Same interface, same citation behaviour, same brief shape,
completely different Cypher and different node labels. That answers "is this a
replicable workflow or one gallium query?" with an observation instead of a claim —
and unlike a second material, it cannot come back empty.

## Caveats

- Counts are single-run observations on the venue stack on 4 October, not
  benchmarks. Re-run before quoting any of them.
- Row limits truncate several of these (5 shown here with `LIMIT 5`); a limit is
  not a total.
- Every name above is synthetic pack data. Nothing here maps to a real company,
  platform, or programme.
