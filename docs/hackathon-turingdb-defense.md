# TuringDB Defense — Submission Plan (Connected Data in Defense)

> Track: **4 — Connected Data In Defense: Using Graphs For Real-Time Intelligence**
> Source: https://github.com/turing-db/turingdb-hackathon-defense
> Status: **built & verified (venue floor)** — Postgres + PostGIS ledger intact;
> TuringDB graph layer wired alongside it and curl-verified live. See
> "What shipped" below. Graphs are runtime data (`graphs/README.md`), not committed.
> Venue start/health: `bash scripts/venue.sh`. Follow-on prize track:
> [hackathon-nebius-nvidia.md](hackathon-nebius-nvidia.md) (30 Oct deadline, after EDTH).

## What shipped (verified live, Oct 2026 — venue floor, no Postgres tunnel)

Primary wedge: `supply_chain_deep` (133k nodes / 764k edges) + `logistics_risk`
+ `power_plants` from the prebuilt pack. All timings measured, not estimated.

| Piece | Where | Verified |
|---|---|---|
| 8-scenario catalogue (BOM 8-hop, gallium, CHN ownership, Taiwan Strait, sanctions gap, Red Sea D01, UKR NEAR, logistics high-risk) | `apps/agent/src/graph/scenarios.ts` | every Cypher run live: 3–13ms per scenario |
| Bench (4 fastest) | `GET /api/graph/bench` | 265ms total |
| Blast + replay tools in agent loop | `get_blast_radius`, `replay_at` in `tools.ts`, wrapped as Strands tools, scripted brain calls blast every run | trace shows graph + Postgres retrieval |
| Simulate-branch + diff | `POST /api/graph/simulate`, `POST /api/graph/diff` | 0→2→0 abandon verified; added/removed samples across commits |
| Witness-pack hash chain | `POST /api/graph/witness`, `GET /api/graph/witness/:hash` (+ share links) | round-trip + prev-linking verified |
| Watch-room panel (scenarios, guided mode, diff, witness export + copy link) | `GraphPanel.tsx` | `/watch` 200 |
| Public witness page (link, not file) + re-run + pilot CTA | `app/witness/[hash]/` | 200, links resolve |
| No-DB digest loop (subscribe → notify → wall) | `/api/loop/*`, `app/digest/` | subscribe→notify→wall verified E2E |
| Pilot funnel + one-pager + diligence block | `/api/pilot-interest` (degraded-mode counter), `app/pilot/`, `docs/pilot-one-pager.md` | 201 + count verified |
| GTM: EY talk-tracks, 5 discovery Qs, pipeline tracker, pitch script, jury crib | this doc + one-pager | written, numbers sourced |

Distribution loop (Thiel): blast → witness link → QR scan → re-run → pilot form
→ digest lane → forward. Generate the printable QR targets with
`bash scripts/witness-qr.sh` → `apps/agent/data/witness-sheet.html`.

Known limits: Postgres ledger needs its tunnel (graph half runs standalone —
lead with defense). Witness chain, digests, pilot counter are **SQLite-durable**
(`apps/agent/data/bothy-loop.db`, verified across a full agent restart).

## Venue runbook (the unbreakable starting state)

One command brings all four services up, idempotent, with health gates:

```bash
bash scripts/venue.sh          # start (TuringDB → sidecar → agent → web) + warm graphs
bash scripts/venue.sh status   # health of all four, colour-coded
bash scripts/venue.sh stop     # stop agent/sidecar; TuringDB left running
bash scripts/witness-qr.sh     # fresh witness packs + printable QR sheet
```

- **Detached, not fragile.** Services are launched through
  `scripts/daemonize.py` (`os.setsid`) so they survive Ctrl-C, terminal close,
  and process-group kills — `nohup` alone does not, because macOS `nohup` children
  share the launching process group.
- **Durable state.** Witness chain, loop digests, and the pilot counter live in
  SQLite keyed beside the agent (`DATA_DIR` resolves from `import.meta.url`, so it
  is the same file regardless of cwd). Verified: write → `venue.sh stop` → start →
  all three still read back.
- **Warm graphs.** Startup runs a count query per graph so the first demo query
  is not the cold one (bench ~265ms warm vs ~450ms cold).
- **Failure modes and fallbacks:**

| Symptom | Likely cause | Fallback |
|---|---|---|
| sidecar fail | `graphs/supply_chain_deep` missing | see `graphs/README.md` (clone the pack) |
| agent fail | Postgres tunnel down on a floor | graph routes never depend on it; pilot/digest degrade to SQLite (they report `degraded:true`) |
| web fail | Next still compiling | `status` again after ~10s; check `/tmp/web-venue.log` |
| QR page 404 | agent restarted **and** SQLite wiped | re-run `witness-qr.sh` (regenerates packs) |
| bench slow (>500ms) | cold graph | `venue.sh start` re-warms, or `status` then re-run |

## Thesis

Bothy becomes the **accountable intervention layer on top of a versioned TuringDB graph** for contested logistics / critical-infrastructure resilience:

> Fragmented signals → one fused graph → multi-hop blast-radius reasoning → a specific, evidence-backed, human-approved intervention.

The product invariants don't change: **reports, not media** (every source lands as a timestamped, named-source citation) and **the agent drafts, a human approves**. TuringDB gives us what Postgres can't: deep multi-hop traversals at speed + git-like versioning (replay / branch-to-simulate / diff).

## Why Bothy fits

| Brief requirement | Bothy today | TuringDB adaptation |
|---|---|---|
| Deep multi-hop queries at speed ("what is connected to what, what breaks if this node falls") | 1-hop only: route + its events → score (`risk.ts`) | Move traversal to TuringDB Cypher: `Route-[:DEPENDS_ON|SUPPLIES|NEAR]->*` blast radius, supplier → part → site cascade, single-source risk |
| Versioning: replay past state, branch to simulate, or diff two points in time | Timeline scrubber + `risk_snapshots` every 30min + A66 backtest lead-time story (18:40 speeds fell → 23:40 closure) | Commit graph per ingestion tick; replay snapshot at `T`; branch to simulate "grit A66 / close pass"; diff before/after as evidence |
| Fuse multiple sources into one graph | 5 kinds in one ledger: `warning\|forecast\|road\|incident\|traffic` (+ flood gauges) | Same ledger → graph nodes/edges; add `supply_chain` + `logistics_risk` datasets as second wedge |
| Location + time as queryable properties | PostGIS `geom` + `at` timestamps, geo + date + hazard filter then semantic rank | Carry `lat/lng/at` onto nodes/edges; Cypher `WHERE` on time + distance / `NEAR` edges |
| Usable by operator, system, or agent | Duty-officer approve/reject gate, `create_human_review` single exit, audit log | Keep gate unchanged; agent tools call TuringDB instead of Postgres for retrieval |

Low competition (4 teams at time of writing) + Bothy's existing replay/audit story = good odds if we do the graph-layer work. A Postgres-only entry won't score.

## Defense reframe (pick one)

1. **Supply-route resilience (primary, least rework).** Close to current winter-roads wedge: `supply_chain` + `logistics_risk` + weather/closure signals → "PO delayed / pass closed → which sites, parts, orders are affected N-hops out?" + single-source risk.
2. **Energy / critical infrastructure (backup).** `power_plants` + `NEAR` (plants within 10km) + weather → co-located clusters and cross-border neighbours exposed to a single strike/hazard; ownership + fuel concentration.
3. **Out of scope:** cyber playbooks (`attack_scenarios`), POLE investigation, drone-swarm autonomy. Bothy's intake contract excludes firehose/media and autonomous action — don't reopen it for this hack.

## Open-source leverage map (don't rebuild — reuse + cite)

Researched Oct 2026 via Tavily + repo reads. Rule: **steal the schema, the
query pattern, and the demo trick — not the dependency** unless it ships in a
weekend. Verify licenses at build time before redistributing data.

### A. Hackathon pack itself (pre-built, zero wrangling) — use first

Source: `turing-db/turingdb-hackathon-defense` — 7 prebuilt graphs under
`graphs/`, schemas + queries + licenses in `docs/`, `/turingdb` Claude skills
in `skills/turingdb`. Server: `turingdb start -turing-dir <repo> -ui`
(:6666 API, :8080 visualizer). Python: `TuringDB("json",
host="http://localhost:6666")` → `load_graph` → `set_graph` → `query()`
returns a pandas DataFrame. Only `graphs/` is versioned.

| Graph | Scale | Schema (labels → edges) | Demo primitive to steal | License |
|---|---|---|---|---|
| `supply_chain` (primary) | 30k nodes / 90k edges | `Part` (300, criticality A/B/C, lead_time) `SUPPLIED_BY`→ `Supplier` (40); `PurchaseOrder` (29k, promised vs receipt) `FOR_PART`→`Part`, `FROM_SUPPLIER`→`Supplier`, `DELIVERED_TO`→`Site` (6); `QualityIncident` (368) `ABOUT_PART`/`FROM_SUPPLIER`/`AT_SITE` | Supplier blast radius: delayed PO / quality issue → part → every affected site; OTIF + risk concentration per supplier. Template for `get_blast_radius` | MIT, synthetic |
| `logistics_risk` (risk-shaped, closest to Bothy) | 118k nodes / 233k edges | `Shipment` (113k, feature vector ON the node: delay_prob, disruption_likelihood, route_risk, customs, weather_severity, deviation) `FROM_SUPPLIER`→`Supplier` (3.5k) `SUPPLIES`→`Product` (1k), `LOCATED_IN`→`Country` (94); `CLASSIFIED_AS`→`RiskClassification` (High 84k / Mod 18k / Low 11k) | Risk-by-geography/product traversal; supplier reliability vs outcomes; feature frame + target one hop away (ML hook for "predictive" slide) | Apache-2.0 |
| `power_plants` (backup) | 45k nodes / 149k edges | `PowerPlant` (35k, lat/lng, capacity, fuel, owner, country) `LOCATED_IN`→`Country` (167), `PRIMARY_FUEL`/`ALSO_USES`→`Fuel` (15), `OWNED_BY`→`Owner` (10k); `NEAR {distance_km}` plant↔plant, 56k pairs ≤10km, match **undirected** | Single-strike exposure: "what else within 10km?" (densest cluster 57); cross-border pairs; ownership concentration. `NEAR` landed as its **own commit** — a live `db.history()` versioning demo | CC BY 4.0 (WRI — attribute) |
| `drone_swarm` (pattern only) | 21k nodes / 100k edges | `Reading` (20k telemetry) `OF_DRONE`→`Drone` (20), `AT_TIME`→`TimeStep` (1k), `IN_FORMATION`/`HAS_MISSION`; `NEXT` chains per drone | Time-as-graph: `NEXT` chains = replayable trajectory. Steal the idea for Bothy signal ticks if needed | CC BY 4.0, synthetic |
| `attack_scenarios`, `poledb` | see pack docs | Cyber kill-chain KB; POLE crime entities (synthetic persons) | Out of scope per intake contract — do not touch | MIT / OGL v3.0 |

Also: `supply_chain_deep` (multi-tier generator in `scripts/`, MIT) if we need
>1-tier depth for the "deep multi-hop" line. Skills worth reading:
`querying.md` (Cypher dialect quirks), `importing.md` (CSV/JSONL→graph),
`introspection.md` (schema + versioning/time-travel), `algorithms.md`
(Dijkstra, vector search).

### B. Blast-radius query patterns (copy the Cypher, adapt labels)

- **Neo4j pharma supply-chain demo** (`neo4j-product-examples/demo-supply_chain`,
  Apache-2.0): product flow, supplier-dependency analysis, batch traceability,
  bottleneck/circular-logistics detection + a Google ADK AI agent on top.
  Steal: their "trace full path of a SKU" query shape and the **agent-over-graph**
  architecture (validates our Strands→TuringDB tool design); their NeoDash
  dashboard = precedent for our scrubber+graph view.
- **Neo4j supply-chain-logistics-demo** (GDS blog-series companion):
  graph-data-science scoring on supply chains — precedent for "risk score lives
  next to traversal" (our `risk.ts` + Cypher hybrid).
- **AI Supply Chain Simulator** (open-source, networkx + PyVis + Streamlit;
  Prophet/LightGBM forecasting + disruption-scenario engine with live
  cost/emissions/risk recalc): the **what-if simulation UX** to copy for our
  branch-simulate screen. Ours differs by running on a versioned graph with an
  approval gate instead of Streamlit.

### C. Versioning primitives (the scored capability)

- **TuringDB native**: every change is a commit; branch/merge/time-travel are
  engine primitives; `NEAR`-as-separate-commit in `power_plants` is the proof.
  Use `CALL db.history()`-style introspection live in the demo — no
  application versioning code needed.
- **TerminusDB** (`terminusdb/terminusdb`, Apache-2.0, 3.4k stars): "git for
  data" — branch/diff/merge/push/pull with query-any-branch (no checkout). If
  TuringDB versioning docs stall mid-hackathon, TerminusDB's documented
  branch→edit→diff→merge flow is the fallback mental model and the citation
  that "versioned graphs" are a real category, not our gimmick.
- **RecallGraph / Datahike / Crux** (temporal-graph lineage): backup vocabulary
  only — name-drop "bitemporal history" if a technical juror probes.

### D. Energy wedge (backup) + viz/accountability (polish)

- **PyPSA** (`PyPSA/PyPSA`, MIT) + PyPSA-Eur open European grid model: use as a
  **credibility citation** ("our exposure graph joins to the same open grid
  models TSOs plan on"). Do NOT integrate over the weekend.
- **RESILIENT (TU Berlin)**: 126 PRs into the PyPSA ecosystem, stochastic
  resilience analysis — validates "resilience" as funded research, good
  mentor-conversation anchor.
- **Graph viz**: TuringDB's own :8080 visualizer suffices for v1; Cytoscape.js
  (MIT) or xyflow/React Flow (MIT) only if Sunday morning is free.
- **Accountability tailwinds** (cite, don't integrate): Rootsign
  (tamper-evident agent decision log), Prismer signet (every action a receipt),
  TraceFold (escrow-the-inverse/undo), `yzhao062/awesome-auditable-ai`
  (curated audit literature). One name-drop on the "why accountable" slide.

### E. Sharpened wedge (from this research)

> Others demo traversals on static dumps. Bothy demos **accountable
> intervention on a versioned graph**: a multi-hop blast-radius query
> (pre-built pack data, MIT/Apache) → a cited draft → a human approval → a
> git-like commit, with replay/branch/diff as the audit trail. Logistics
> primary (`supply_chain` + `logistics_risk`, 120k+ nodes, zero wrangling),
> energy backup (`power_plants` NEAR + ownership, WRI data).

Why this wins vs rebuild: zero data-wrangling (graphs committed), query
patterns copied from Neo4j's own demos, versioning native to the engine,
what-if UX copied from the Streamlit simulator, viz from the bundled :8080
UI. Weekend work is wiring + story, not infrastructure.

### F. Same-genre references (peers, not primitives)

Same shelf as Bothy: fuse signals → assess → get a human to decide. Cite
these on the "landscape" slide to show we know the genre — and our wedge out
of it. Rule stays: cite, don't integrate (except where noted).

- **OpenCTI** (`OpenCTI-Platform/opencti`, Apache-2.0 CE, 10k stars): the
  reference open-source intel-fusion platform — STIX2 entity/event graph,
  connectors for ingestion, rich investigation UI. Closest "connected data
  → operator" product in OSS. Our wedge vs it: OpenCTI is analyst-driven
  investigation; Bothy is agent-drafted + human-approved intervention with
  versioned replay. Steal: their connector-fan-in mental model for "N sources
  → one graph" and their investigation-view layout precedent.
- **Ushahidi** (`ushahidi/platform`, AGPL-3.0, 700+ stars): the canonical
  crisis-mapping platform — SMS/Twitter/RSS/email → categorized, geo-located
  reports on a map (backend here, `platform-client-mzima` for UI). Direct
  ancestor of Bothy's "reports, not media" + citizen-signal fusion. Wedge vs
  it: Ushahidi crowdsources and maps; Bothy scores, drafts, and gates on a
  versioned graph. Note AGPL — reference only, do not fork into our tree.
- **Sahana Eden** (humanitarian/disaster management — incident tracking,
  resource mapping, situation reporting; repo lookup 404'd Oct 2026, verify
  canonical `SahanaFOSS` remote before citing): the duty-officer workflow
  reference — request/aid matching, facility + volunteer registries. Cite as
  the genre's workflow baseline we compress into one agent loop.
- **Timesketch** (`google/timesketch`, Apache-2.0, 3.4k stars): collaborative
  forensic timeline analysis — sketches, annotations, tags over shared
  timelines. This is the OSS precedent for our scrubber/backtest story
  ("replay the incident as a timeline, collaboratively"). Steal: sketch +
  annotate + star UX language for the replay view.
- **HumanLayer ACP** (`humanlayer/agentcontrolplane`, Apache-2.0, ~500
  stars): K8s-native agent orchestrator with durable execution +
  human-approval-as-a-tool (incl. tiered/mcp-tool approvals on roadmap).
  Validates `create_human_review` as an industry pattern, not a hack —
  "approval is a tool call the agent blocks on." Cite if a technical juror
  asks why the gate is load-bearing.
- **Monitoring-The-Situation** (`danielrosehill/Monitoring-The-Situation`):
  curated index of OSS situational-awareness / COP / intel-fusion projects
  (explicitly excludes Grafana-style metric boards; covers news grids, OSINT,
  fusion backends, feed aggregation). Use as the "we surveyed the genre"
  citation and as a hunting list for any gap (feed backends: FreshRSS/Miniflux;
  OSINT: SpiderFoot) — pick nothing from it during the weekend except ideas.
- **FIR** (`certsocietegenerale/FIR`) / **FlowIntel**: fast incident-response
  case management for CSIRTs/CERTs — the incident-card + task-trail pattern
  our audit receipt mirrors. One-line cite under "auditability has precedent."

Landscape one-liner for the deck: "Ushahidi maps the crisis, OpenCTI
investigates it, Timesketch replays it — Bothy closes the loop: versioned
graph → cited draft → approved intervention."

## Proposed graph model

Map the existing ledger 1:1 first, then add the defense wedge:

```
(Route)-[:HAS_EVENT]->(Signal)
(Route)-[:DEPENDS_ON]->(Route|Site)
(Site)-[:DEPENDS_ON]->(Supplier)
(Supplier)-[:SUPPLIES]->(Part)
(Part)-[:USED_AT]->(Site)
(PowerPlant)-[:NEAR]->(PowerPlant)        # from power_plants dataset
(Signal)-[:OBSERVED_AT]->(Time)            # or `at` property on Signal
All geo nodes carry lat/lng; all Signals carry at + source + kind
```

- Nodes from current tables: `routes`, `signal_events`, `incidents`, `assessments`.
- Edges derived: `HAS_EVENT` (signal.route_id), `DEPENDS_ON` (corridor adjacency / site dependency — new, small seed), `NEAR` (PostGIS `ST_DWithin` precompute or dataset's edges).
- Defense seed: import `supply_chain` and/or `logistics_risk` CSV/JSONL via TuringDB import (`skills/turingdb` `importing.md`) alongside Bothy ledger; keep Bothy `id`/`scenario` keys for join-back.

## Versioning story (pick at least one for judging)

- **Replay:** commit per scenario tick (e.g. every 30min of case tape). Scrubber sets `T` → checkout/commit-pinned read → re-render evidence + score. "What did this network look like before the incident?"
- **Branch to simulate:** `branch simulate/grit-A66` → apply hypothetical `road` event (plough-complete) or remove closure → re-run blast-radius query → show delta in affected sites/routes. Discard or merge.
- **Diff:** `diff(commit(pre-storm), commit(post-closure))` → added/removed edges + risk-label changes as the citation list.

TuringDB primitives to use: commits, branches, time-travel reads (see `skills/turingdb` `introspection.md`).

## Multi-hop queries to demo (Cypher sketches)

```cypher
// 1. Blast radius: what breaks if this node falls? (N-hop)
MATCH (r:Route {id:'r-A66'})-[:DEPENDS_ON*1..4]->(dep)
RETURN dep.kind, dep.id, dep.name;

// 2. Closure → affected sites through parts/suppliers
MATCH (s:Signal {kind:'road', headline:'closure'})<-[:HAS_EVENT]-(r:Route)
MATCH (r)-[:DEPENDS_ON*1..3]->(site:Site)
      <-[:USED_AT]-(p:Part)<-[:SUPPLIES]-(sup:Supplier)
RETURN site.id, sup.id, p.id;

// 3. Single-source risk (supplier concentration)
MATCH (sup:Supplier)-[:SUPPLIES]->(p:Part)-[:USED_AT]->(site:Site)
WITH sup, count(DISTINCT site) AS sites
WHERE sites >= 3
RETURN sup.id, sites ORDER BY sites DESC;

// 4. Time-bounded signals on a corridor
MATCH (r:Route)-[:HAS_EVENT]->(s:Signal)
WHERE r.corridor = 'pennines' AND s.at >= $t0 AND s.at <= $t1
RETURN r.id, s.kind, s.at, s.source ORDER BY s.at;
```

All four must run through the agent's read tools (not just the visualizer) so the Strands trace shows graph retrieval → cited draft.

## Build plan

1. **Stand up TuringDB (½ day).** `uv add turingdb`, `turingdb start -turing-dir <dir> -ui`; install `/turingdb` Claude skills; verify `power_plants` sample query + visualizer `:8080`.
2. **Import Bothy ledger (½–1 day).** Export `routes` + `signal_events` (+ A66 backtest tape) to CSV/JSONL → import script → confirm node/edge counts vs Postgres.
3. **Add dependency edges (½ day).** Small seed for `DEPENDS_ON` corridor adjacency + one defense dataset (`logistics_risk` preferred — risk-shaped, closest to Bothy). Keep it tiny: one corridor, ≤3 hops.
4. **Agent wiring (1 day).** New/repointed read tool (e.g. `get_blast_radius`) calling TuringDB `query()` (pandas DataFrame → `EvidenceCitation`s); versioning tool (`replay_at` / `simulate_branch`) for the scrubber; keep `create_human_review` + provenance hook unchanged.
5. **UI: replay + branch + diff (1 day).** Scrubber reads at `T` from TuringDB snapshot; "simulate" button creates branch + hypothetical event; diff view lists added/removed edges + label changes.
6. **Demo + docs (½ day).** 5-min tape: quiet room → signals land → blast-radius query → branch simulation → approve with receipts.

Total ≈ 3–4 focused days. If time is short, cut the second dataset, never the versioning demo — versioning is explicitly scored.

## Risks / non-goals

- **Risk:** TuringDB Cypher dialect quirks + Python-SDK-only reads from a TS agent (bridge via HTTP `:6666` or a small Python sidecar). Spike this first.
- **Risk:** Over-scoping to cyber/crime/drone wedges that break the intake contract. Stay on logistics/energy.
- **Non-goals:** drone/swarm autonomy, social/radio firehose, autonomous publishing — all still excluded. The human-approval gate is the defense auditability story, not a limitation.

## EDTH judging alignment (how we score on all 7 criteria)

Source: EDTH "How to Succeed" guide. Jury = 5–7 people (Ukrainian + European
military, industry, VC, technical). Each scores 0–10 on 7 criteria; scores guide
a deliberation, highest total does not auto-win. The real goal is a prototype
worth continuing after the weekend.

| # | Criterion (jury question) | Bothy answer |
|---|---|---|
| 1 | Relevant problem — does this matter? | Contested logistics: a closed pass / delayed PO cascades N-hops to sites, parts, orders. Russia's targeting of Ukrainian logistics + energy makes "what breaks if this node falls?" an urgent, real-world question. |
| 2 | Feasibility — does it work? | Working prototype: Bothy already runs (Postgres+PostGIS, agent → cited draft → human approval). Weekend adds TuringDB graph + blast-radius + branch-simulate on top. Demo is live queries, not slides. |
| 3 | Originality / innovation — is this novel? | Accountable agent on a versioned graph: multi-hop blast radius + replay/branch/diff + every claim cited + human approval gate. Restraint as a feature (room rests when quiet) vs noisy dashboards. |
| 4 | Mass-manufacturability — is this scalable? | Software-only, no special hardware. Runs on a laptop/server; TuringDB embedded (`turingdb start`), works offline / in DIL (denied, intermittent, low-bandwidth) environments — the standard field pattern is air-gapped updates + local compute. Zero unit cost to replicate, deployable to any HQ/log cell. |
| 5 | Business opportunity — is there demand? | Buyers: NATO enablement/sustainment chain (JSEC coordinates reinforcement + sustainment across Europe; JLSG executes joint logistics for the task force), national logistics / movement commands, critical-infrastructure operators (energy, transport). Route: pilot with a logistics cell → paid resilience module. |
| 6 | Size of opportunity — multi-billion? | Yes. Defense logistics: ~$174B (2025) → ~$286B (2033), ~6.4% CAGR (ResearchAndMarkets via GlobeNewswire, Jan 2026); alternate cut $204B (2022) → $330B (2032) (Allied Market Research). Supply-chain & logistics software: ~$32.8B (2026) → ~$88.9B (2035) (BusinessResearchInsights). Critical-infrastructure protection: ~$154B (2025) → ~$197B (2030), ~5.1% CAGR (MarketsandMarkets, Sep 2025). Even a thin software slice is multi-billion. |
| 7 | Pitch — clear demo/MVP? | EDTH format: PDF/PPTX named `NN_ProjectName.pdf` by Sunday noon + linked demo video; 3-min pitch covering (a) problem (b) technical how (c) deployment/manufacturing (d) what we achieved this weekend. Story frame below. |

### Deployment / field story (for criterion 4 + "Zaporizhzhia at night" test)

- **What it is:** software-only decision-support, no drone/hardware build, no 3D printing or soldering needed.
- **Where it runs:** single laptop or HQ server; TuringDB embedded store + existing Next.js + TS agent. No cloud dependency for the demo; production pattern is edge/air-gapped delivery (verified updates via Zarf/UDS-style pipelines, local inference) — standard for DIL environments.
- **Field use:** duty officer / logistics cell with intermittent connectivity: ingest signal ticks when connected, reason locally when disconnected. Low-bandwidth friendly (text citations + scores, not video).
- **Mass-manufacture = replicate:** `docker compose up` + seed + `turingdb start`. Cost per new user ≈ 0. Scale is data ingestion, not hardware.

### Business + market (for criteria 5–6)

- **Who pays:** (1) military logistics/enablement commands and their software primes; (2) dual-use infrastructure operators (grid, transport, ports) with NIS2/CIP obligations in Europe; (3) humanitarian logistics NGOs as a low-price wedge.
- **Why now:** geopolitical tension + military modernization + shift from centralized sustainment to distributed, data-driven networks (Technavio/Defense Logistics outlook); EU NIS2 driving CIP spend (~4.2% CAGR in Europe); defense budgets rising in US/DE/UK/PL.
- **Market framing for the deck (one slide):** show the three numbers above, then narrow: "we sell the accountable-reasoning layer inside the $33B logistics-software wedge — priced per HQ/cell per year, deployable in a weekend."
- **After the hackathon:** submit via the EDTH form; opt into deal-flow update + virtual Demo Day + showcase; join EDTH Unlimited community (1 yr free access). IP stays with the team; everything shared is non-confidential by default.

### Weekend-scope bright line (for "what did you achieve during the hackathon?")

Pre-existing (do NOT claim as weekend work): Bothy Postgres ledger, 5-source fusion, risk scoring, timeline scrubber UX, approval gate, A66 backtest.
Weekend-built (the claim): `supply_chain_deep` + `logistics_risk` + `power_plants` wired as the defense graph; 8-scenario catalogue with verified Cypher; `get_blast_radius` + `replay_at` agent tools (Strands-wrapped); `/api/graph/*` (query/history/simulate/diff/witness/bench/scenarios); watch-room GraphPanel with guided Blast→Replay→Simulate + witness export; public `/witness/:hash` share links; no-DB `/api/loop/*` digest loop + `/digest` wall; pilot funnel (`/pilot` + counter) + one-pager; EY talk-track + pitch script + jury crib.
Mentor check (Friday): validate the logistics-resilience wedge + data sensitivity with a mentor before building; keep everything within legal/ethical/export-control bounds; flag anything unclear to organizers.

## GTM motion + EY engagement plan

Why EY: the A&D practice advises on the exact buyer (primes, ministries, TSOs)
navigating Readiness 2030 + the Defence Readiness Omnibus (Jun 2025 — removes
procurement/permit/cross-border bottlenecks) + EDF calls (munitions, ISR, air
& missile defence, digital). EY's Path-to-Sovereignty 2026 paper prices the
sector (EU defence ~26.5x 2026 P/E, compressing on growth). Our wedge inside
their narrative: Omnibus buys speed; Bothy makes speed auditable.

30-sec talk-track: "We run blast-radius queries on defence supply chains in
milliseconds — 8 hops, platform to mine — then hand the duty officer a cited
draft to approve, with a hash-linked witness-pack. Two-week pilot, your BOM,
€15k indicative. Who in A&D should see the Taiwan-Strait slide?"

3-min version: problem (tier-3 blindness) → live blast (gallium 34 platforms,
8ms) → replay + simulate + diff → business (numbers above) → ask (pilot cell
+ A&D intro).

5 discovery questions for the EY organiser:
1. Which A&D clients feel tier-N blindness most acutely right now?
2. How are log cells doing exposure-mapping today — spreadsheets, primes' data, or nothing?
3. Where does Omnibus procurement speed create the most audit pressure?
4. Who owns the witness/audit trail when a disruption hits — the cell, the prime, or no one?
5. What would a credible 2-week pilot need to show for you to intro us onward?

Pipeline tracker (live: `/pilot` + pilot-interest counter):

| Org | Contact | Angle | Status | Next step |
|---|---|---|---|---|
| EY A&D organiser | — | venue host, innovation remit | target | 30-sec track + one-pager |
| JSEC/JLSG-adjacent cell | via mentor intro | sustainment exposure | target | scenario walkthrough |
| 1 prime (TBD) | via EY intro | BOM risk | target | pilot scoping |
| 1 TSO (TBD) | via energy scenario | NEAR exposure | target | UKR-proximity demo |

Traction = countable: pilot-interest submissions (live counter), witness-pack
downloads (hash-chained), mentor quotes (name + line). Capture all three in
the deck appendix.

## 3-min pitch script

| Beat | Time | Line |
|---|---|---|
| Problem | 0:00–0:40 | Tier-3 blindness: one mineral, subsidiary, or strait stalls a programme. Omnibus buys speed; speed without exposure-mapping is risk. |
| Live blast | 0:40–1:30 | Run gallium (34 platforms, 8ms) + Taiwan Strait primes live. "Milliseconds, 8 hops, 764k edges." |
| Replay + simulate | 1:30–2:10 | History → pin commit → diff before/after. Branch a closure, abandon it. "Versioning is the audit trail." |
| Business + EY | 2:10–2:40 | $174B→$286B logistics; pilot €15k; built for the Readiness-2030 buyer EY advises. |
| Ask | 2:40–3:00 | "Ushahidi maps, OpenCTI investigates, Timesketch replays — Bothy closes the loop. Pilot cell + A&D intro. Witness-packs at the desk." |

Jury Q&A crib:

| Q | A |
|---|---|
| Export control / data sensitivity? | Pack data fully synthetic (MIT/Apache/WRI); pilot runs on buyer data in their cell; nothing leaves. Flagged with mentors Friday. |
| Why TuringDB vs Neo4j? | Native versioning (commit/branch/time-travel) + ms multi-hop on 764k edges; Neo4j patterns copied, engine chosen for the scored capability. |
| What did you build this weekend? | Graph layer: catalogue, tools, panel, simulate/diff/witness, bench, pilot funnel. Ledger + gate pre-existed (bright line above). |
| Who pays? | Log cells, primes (BOM risk), TSOs (NIS2). Pilot €15k → cell €60k/yr indicative. |
| Offline? | Yes — DIL-tolerant: embedded graph, local reason, ingest when connected. |
| Scale? | 764k edges at ms latency on a laptop; scale is ingestion, not hardware. |
| Moat? | Accountable loop (blast → draft → approve → witness), not the graph; versioned audit category. |
| What breaks? | Writes need the change workflow; sidecar is single-client; Postgres tunnel needed for full ledger (graph works alone). |

## Demo + pitch spine (EDTH format: 3-min pitch + video)

Deck due Sunday noon as `NN_ProjectName.pdf` (replace NN with team number)
with linked demo video. 3-min pitch + 1–2 jury questions. Cover (a) problem
(b) technical how (c) deployment/manufacturing (d) weekend achievement.

Story frame: "For the logistics duty officer watching a contested corridor do
its nightly resupply, we built accountable graph reasoning. It keeps the unit
moving, stops cascade failures early — software-only, runs on a laptop,
costs ~nothing to replicate."

60-sec video beats (record Saturday night, re-record Sunday if needed):

1. Quiet corridor, room rests (restraint as a feature) — 10s.
2. Signals land (warning → forecast → speeds fell → closure); blast-radius
   query shows N-hop affected sites/parts/suppliers — 20s.
3. Replay to pre-incident state; branch "what if we grit/close early?"; diff
   the two states — 15s.
4. Agent drafts with graph citations; duty officer approves; audit receipt.
   Close: "Agents, but accountable — on a versioned graph." — 15s.

Slide order: problem → feasibility (live query screenshot) → technical
(graph model + Cypher + versioning) → deployment (laptop/DIL/replicate) →
business + market (buyers + 3 numbers) → weekend achievement (bright line
above) → team (why we win) → demo link + ask (pilot with a logistics cell;
join EDTH Unlimited / Demo Day).
