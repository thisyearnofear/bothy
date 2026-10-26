# Open Agent Hackathon 2026 — prep brief

GenAI.works · 22–27 Oct 2026 · fully online · solo entry.

## Progress log (22 Oct, Day 1)

- **Infra**: Zetaris platform live on `snapflip-vultr` (`~/zetaris/zetaris-platform`,
  all 9 verify checks pass). Tunnels from the Mac: `3000`→UI, `8888`→API,
  `11434`→Ollama/`nemotron-mini` (`scripts/model.sh` for the model lane only).
- **Zetaris (live)**: API key created via `/api/v1.0/auth/api-key`, in gitignored
  `.env`. **Sources onboarded**: `company_dns_eu` (EU NACE hierarchy) and
  `SEC_DATA/edgar` (7-company revenue facts) — `onboard.py run` all ok.
  Working REST contract: `POST <ui-origin>/api/proxy/sql-editor/sqls/run(-query)`,
  Bearer key + `X-Org-ID: 1`. Bothy client verified: `SELECT 1` via
  `zetarisStatus()` → `reachable: true`.
- **Meterless (done)**: H-MEM engine vendored into `apps/agent/src/memory/hmem/`,
  conformance 13/13. `caseMemory.ts` wires recall-into-draft, post-commit decision
  recording, `GET /api/defense/memory`, and a `CaseStatusPanel` workspace strip +
  "Recalled case memory" block in briefs.
- **UX**: investigate flow reordered evidence-first; clickable journey stepper;
  dev chrome stays below the fold.
- **Tests**: 35/35 agent tests, tsc + eslint clean on both apps.
- **Still needed**: ~~inventory CSV filestore registration~~ done 26 Oct
  (`BOTHY_OPS.inventory_contracts`, via shared customer-data volume);
  ~~federated-evidence capture path in `defense.ts`~~ done 26 Oct
  (`federated_runs` + reviewed catalogue + cited federated claims);
  Discord + sponsor-channel questions; Cursor seat time.

## Deadlines (all UTC, no timezone slack)

| When | What |
|---|---|
| **Today, 22 Oct 23:45** | Registration closes (hard) — already registered |
| 28 Oct | Judging opens (immediately after close) |
| **27 Oct 23:45** | Submissions close (hard) |
| 6 Nov 16:00 | Results (live call on HackOS) |

## What judges reward (Welcome Guide §3)

Weak = linear pipeline / prompt wrappers, no feedback loops, no trace of how
the output was reached. Strong = dynamic delegation, critique/validate steps,
**shared memory/context**, branching/retries/escalation, and **logs or traces
showing reasoning**. Bothy maps onto this cleanly — make the mapping explicit
in the submission:

| Rubric trait | Where bothy shows it |
|---|---|
| Feedback loop | Question → captured evidence → drafted brief → human review → revision (`POST /briefs/:id/revisions` requires a *separate* capture of the same question) |
| Evaluator | Human reviewer gate is pending-only; lab (`/defense/lab`) shows the refusals — self-approval, replay, audit rewrite |
| Shared memory | Vendored Meterless H-MEM: investigations/decisions persist, recall feeds new drafts |
| Traces | Hash-chained `defense_audit` + H-MEM `ledger.jsonl` + evidence hash/version pins |
| Branching/recovery | Provider chain fallback, scripted deterministic generator as failsafe, typed error recovery in the UI |

The submission write-up should name these explicitly — "shared memory or
shared context" and "logs or traces" are literal checklist items.

## Workshops & help channels (Welcome Guide)

- Data Day (Zetaris, 12 Oct) recording is on HackOS — watch before wiring the
  federated path. Build Day (Cursor + Meterless engines) and Power Day
  (NVIDIA + Meterless local/cloud) dates TBC; watch recordings when posted.
- Sponsor-specific questions go to each sponsor's **Help channel** on HackOS
  (Help Zetaris / Help Meterless / Help Cursor / Help NVIDIA), not just
  #help desk. Academy course: academy.genai.works → Open Agent Hackathon 2026.
- Rules questions: hackathons@genai.works (replies within one working day).

## Rules that shape the plan

- **Rule 5 — every submission must integrate Zetaris AND Meterless, and teams must
  use Cursor for development.** Applies to all tracks, not just Wildcard.
- **Rule 4 — pre-existing code is allowed if clearly declared** in the submission
  form. Bothy can be the base anywhere.
- **Rule 3 — one primary track, changeable until the deadline.** The track choice
  is reversible; do not over-commit today.
- **Rule 6 — submission = 1–4 min demo video + slide deck + public repo + written
  account** of Zetaris/Meterless integration, Cursor usage, and where NVIDIA tech
  contributes.
- Scoring /100: Impact 30 · Technical 20 · Innovation 15 · Demo 15 · UX 10 ·
  Sponsor tech 10. Ties break on Impact, then submission timestamp — submit early.
- In-kind: best NVIDIA Nemotron use wins a DGX Spark (~$4,699).

## Track decision

**Primary: Track 02 — The Agent That Can Explain Why. Fallback: Wildcard.**

Rationale:

- T02's wording is bothy's thesis verbatim: investigate complex questions across
  multiple data sources, connect findings, produce evidence-backed answers.
- The mandatory integrations are identical on every track, so building toward T02
  costs nothing vs Wildcard — and the switch stays open until the deadline.
- T02 pool is $3,700 vs Wildcard $2,000. The risk is judges discounting declared
  prior work in T1–3; Wildcard is explicitly "scored on the new work". Resolve by
  asking the help desk (below); default to T02 unless told prior product code is
  scored away there too.
- Wildcard remains the honest fallback if the answer is unfavourable.

## The five Day-1 answers

1. **Who is the user?** A supply-chain analyst at a European defence prime
   investigating material/supplier/transit disruptions (existing bothy user).
2. **What is the problem?** When a disruption hits, the evidence needed to assess
   programme exposure is scattered across systems that were never joined — the
   analyst cannot produce a cited, review-ready impact brief before the decision
   deadline.
3. **What goes in?** A disruption question (e.g. gallium export controls) plus
   access to fragmented sources: the versioned dependency graph (TuringDB) AND
   operational data the graph never ingested — inventory/ERP extracts, sanctions
   and export-control lists, logistics feeds — federated through Zetaris.
4. **What comes out?** A version-pinned, row-cited impact brief → authorized
   review → owned action → recorded outcome, with the audit trail intact
   (existing bothy loop, now citing federated evidence, not just graph rows).
5. **Why an agent?** The work is iterative source discovery: decide which sources
   could bear on the question, federate queries across them, reconcile
   conflicting rows, pin evidence versions, and follow up where coverage is thin.
   A single prompt cannot pick and join sources it has not seen; a script cannot
   decide which gaps matter.

## Sponsor integration plan (the new work being scored)

Reference repos cloned to `~/Dev/open-agent-2026/` (`meterless/`,
`zetaris-getting-started/`).

| Sponsor | Integration into bothy | Why it is real, not bolt-on |
|---|---|---|
| **Zetaris** (mandatory) | Local/AWS Zetaris instance federating sources the graph lacks: supplier inventory CSV/Parquet, export-control/sanctions REST APIs, a SQL ops extract. Agent issues Lightning SQL — **prefer REST** (`POST /sql-editor/sqls/run` with `ZETARIS_API_KEY`, `X-Org-ID`, `X-Request-ID`) over JDBC so the Node agent has no Java dependency. Returned rows become citable brief evidence alongside graph rows. Source onboarding is scripted: `open_data/manifest.json` + `scripts/onboard.py` (dry-run first). | The graph is curated; real disruption evidence lives in files and APIs. "Multiple data sources" becomes literal, and Zetaris CTO is a judge. |
| **Meterless** (mandatory) | **Engine-level, vendored into `apps/agent`.** The Runtime/Nightshift app is proprietary and ships Windows/macOS/arm64-DGX only — no x86 Linux build, and the 8GB M3 Air can only run the tiny M1+ build. The engines (H-MEM, World Model, Markovian, Scout Intent) are the Apache-2.0 open core — plain TypeScript, model-free mining path, conformance suite. Vendor `engines/hmem/reference/` into the agent: `MemoryMiningService` on investigation events, `MemoryRetrievalService` reinjection into brief prompts ("have we assessed this supplier before?"), `TrustLedgerService` as a second append-only ledger beside bothy's audit. Meterless's own rubric weights engine usage — this is the real integration. | Bothy's audit/memory theme is Meterless's pitch: every run leaves files, decisions, method; compound intelligence. A repeated gallium/supplier query demonstrably starting warm is the demo moment. |
| **NVIDIA** (in-kind prize) | Nemotron served self-hosted on the VPS (Ollama/llama.cpp, OpenAI-compatible → existing `OPENAI_*` provider slot; 4 CPU cores suits a Q4 8–14B). Fallbacks: Nebius (env wiring exists) or NVIDIA build API. | Aims at the DGX Spark prize while reinforcing the "own the throughput" narrative — no Mac resources spent. |
| **Cursor** (mandatory) | Use Cursor for the integration slices; document usage in the submission write-up. `cursor` CLI already installed. Zetaris repo also ships `docs/connections/cursor-connection.md`. | Rule 5 requires it; SpaceXAI partnership. |
| **SpaceXAI** | Check HackOS for Grok/Cursor credit instructions; Grok is a candidate alternate provider via the existing chain. | Judge is SpaceXAI Head of Technical Partnerships. |

## Hardware topology

Mac is an M3 Air / 8GB — keep it dev-only. Heavy infra lives on
`snapflip-vultr` (x86_64, 4c/31GB/104GB free, Docker 29, public IP):

| Component | Host | Notes |
|---|---|---|
| Zetaris platform | **VPS** (Docker Compose) | Needs amd64 + 6–8GB Docker RAM + 15GB — VPS is native x86; Mac can't spare it. Bind ports to localhost; dev access via `ssh -L` tunnels to `snapflip-vultr`. |
| Meterless (H-MEM) | **in-process, `apps/agent`** | TS reference vendored; runs wherever the agent runs, model-free path, zero keys. |
| Nemotron model (opt) | **VPS** (Ollama/llama.cpp) | OpenAI-compatible → `OPENAI_*` provider slot; or Nebius/cloud fallback. |
| Meterless Runtime | **none** | No x86 Linux build exists; Mac M1+ free build optional, not recommended. |
| bothy app + Cursor | **Mac** | Existing `scripts/venue.sh` dev stack. |

## Setup queue (Day 1–2)

- [x] Zetaris **live on the VPS** — `~/zetaris/zetaris-platform`, all 9
      verify.sh checks pass. Ports loopback-bound: UI 127.0.0.1:**3300** (3000
      was taken by an existing container), JDBC 10000, API 8888.
      Access: `ssh -L 3300:localhost:3300 snapflip-vultr` → localhost:3300 →
      sign in admin@zetaris.com (change the password), create an API key in
      the GUI → `ZETARIS_API_KEY` (X-Org-ID defaults to 1).
- [x] Zetaris onboarding: `company_dns_eu_nace` and `edgar_facts` confirmed
      onboarded (SHOW LIGHTNING DATABASES). Inventory CSV registered as a
      filestore table: pushed into the driver's shared customer-data volume
      (`bash scripts/federation.sh push`), then
      `CREATE LIGHTNING DATABASE BOTHY_OPS` +
      `CREATE LIGHTNING FILESTORE TABLE inventory_contracts` —
      full DDL in `data/federated/register.sql`; 10/10 rows verified queryable.
- [x] Meterless: `engines/hmem/reference/` vendored verbatim into
      `apps/agent/src/memory/hmem/` (LICENSE + PROVENANCE.md included);
      upstream conformance suite green — **13/13 checks** via
      `HMEM_IMPL=apps/agent/src/memory/hmem/index.ts npx tsx conformance/runner.ts`.
- [x] Bothy: `src/memory/caseMemory.ts` wraps the engine (persistDir =
      `BOTHY_HMEM_DIR` or `data/hmem/`). Drafts recall prior investigations
      (`brief.memory.recalled` on the shared `DefenseBrief` type), decisions
      record post-commit, `GET /api/defense/memory` exposes engine status;
      panel renders "Recalled case memory". All call sites fail-safe — memory
      can never block the audited path. 35/35 agent tests pass.
- [x] Federated sources picked for the gallium scenario:
      `company_dns_eu_nace` (EU company registry — do "exposed" suppliers map
      to real registered entities), `sic_edgar_usl` or `edgar_facts`
      (SEC filings/classifications for named suppliers), plus one custom
      CSV filestore source (a small synthetic inventory/contracts extract we
      ship in-repo — the analyst's own export the graph never ingested).
- [x] Model lane: Ollama + `nemotron-mini` live on the VPS (localhost:11434,
      verified via `/v1/chat/completions`). `scripts/model.sh up|status|down`
      opens the SSH tunnel; provider chain picks it up via `OLLAMA_BASE_URL`.
      `BOTHY_HMEM_MINER=llm` enables LLM-backed H-MEM mining through the chain.
- [x] Zetaris client scaffolded: `apps/agent/src/integrations/zetaris.ts`
      (exact REST contract from `scripts/zetaris_sql.py`), env-gated by
      `ZETARIS_REST_URL`/`ZETARIS_API_KEY`/`ZETARIS_ORG_ID`;
      `GET /api/defense/federated/status` reports configured/reachable.
      `data/federated/inventory-contracts.csv` shipped as the in-repo
      filestore source (synthetic extract keyed to the gallium scenario).
- [x] UI/product story: "Case memory & reach" strip in the defence workspace
      (`CaseStatusPanel.tsx` — memory count, trust-ledger totals, federation
      status) and "Recalled case memory" block inside each brief. The two
      capabilities a single screenshot can't show — the agent remembers, and
      it reaches outside the graph — are now visible surfaces.
- [x] UX pass on the investigate flow (`GraphPanel`): fixed inverted reading
      order — captured evidence + snapshot now precede the brief they ground;
      added a clickable journey stepper (Question → Evidence → Brief →
      Review & action, anchored to section ids, done/current states driven by
      real state). Dev chrome (replay/compare/simulate) stays below the fold
      in the existing workbench Inspector.
- [x] Federated-evidence capture path (26 Oct): `federated_runs` table mirrors
      `graph_runs`; `integrations/federated.ts` holds the reviewed per-scenario
      Lightning SQL catalogue (gallium-exposure: inventory extract + EU registry
      + SEC filings reach; gallium-chain: inventory). `POST /briefs` and
      `/revisions` capture at draft time; runs bind into the brief via
      `brief.federated.runIds`/`hash`, produce cited claims (rows → per-row
      claims, registry/filings → reach claims), and verify the same way as
      graph evidence — missing/edited federated rows 409 at evidence/review.
      `GET /briefs/:id/federated` serves inspection through the session bridge;
      unconfigured/failed legs degrade to stated gaps, never block the draft.
      Fixed a real bug found wiring this: `ZETARIS_REST_URL` in `.env` carried
      a `/api/proxy` suffix the client re-appends → doubled path 404.
      Tests: 43 agent + 150 web passing.
- [x] Agent-dynamics pass (26 Oct): `brief.reasoning[]` trace on every draft —
      capture pin → per-leg federation results → memory recall → generator →
      citation self-check (`verify: N/N resolve against stored captures`).
      `BOTHY_BRIEF_ASSIST=llm` lets the provider chain draft federated claim
      text (Ollama/Nemotron lane live: `ollama:nemotron-mini drafted 10 cited
      claims`); row-matched lines only, per-row scripted fallback, citations
      never model-controlled. H-MEM recall deduped (top-8 → 3 distinct).
      `.env`: BOTHY_LLM_PROVIDERS=ollama for demo speed; revert for chain demo.
      Federation deepened per org guidance ("make new work meaningful"): the
      ops extract is keyword-filtered to gallium-bearing lines, and the
      registry/filings reach queries were replaced by ONE cross-source
      Lightning query (BOTHY_OPS ∪ SEC_DATA ∪ COMPANY_DNS_EU → single evidence
      projection) — real Zetaris federation, not parallel API calls.
      Cursor requirement relaxed by orgs — any tooling acceptable.
- [ ] Join Discord (announcements); confirm Cursor is the dev surface for the
      new slices; check HackOS for SpaceXAI/NVIDIA credit instructions.

## Product story for the deck and demo

One line: **the analyst's agent that explains why — and remembers what it
already verified.**

Beats for a 1–4 min video:

1. **The question.** A gallium export-control lands. The analyst asks which
   programmes are exposed. (Workspace → investigate.)
2. **Evidence from more than one place.** The curated dependency graph answers
   structure; Zetaris federates what the graph never ingested — the ERP
   inventory extract, company registries, filings — queried in place via SQL.
3. **A brief you can defend.** Version-pinned, row-cited, gaps stated.
   (Show a claim → Inspect row.)
4. **The second question starts warm.** A related question recalls the prior
   investigation via H-MEM — `brief.memory.recalled` on screen, trust-ledger
   totals on the workspace strip. Compound intelligence, not session amnesia.
5. **People stay in charge.** Review → assigned owner → recorded outcome,
   hash-chained audit. The agent advises; it never self-approves (lab shows
   the refusals).
6. **How it's built.** Vendored Meterless H-MEM (conformance-green), Zetaris
   REST federation, self-hosted Nemotron lane, deterministic scripted
   generator as the failsafe.

## Ask the #help desk today

1. Are declared pre-existing components scored equally in Tracks 1–3, or is only
   new work counted there as in Wildcard? (Decides T02 vs Wildcard.)
2. Where are the SpaceXAI/Grok and NVIDIA credit/access instructions?
3. Does "must use Cursor" require the IDE specifically, or does Cursor CLI/agent
   usage qualify?

## Day-by-day plan (official rhythm vs our state)

Official rhythm says Day 1 = scope/skeleton + connect sponsor tech; 23–24 =
evaluator loops, retries, shared memory + activity logging; 25 = data/tools +
failure tests; 26 = README + deck + video + clean-setup test; 27 = submit early.

We are roughly a day ahead: skeleton, memory, logging and the evaluator gate
already exist — the build window went to sponsor integration instead.

- **Thu 22 (today)**: brief done; Meterless vendored + conformance green;
  model lane live on VPS; Zetaris client scaffolded. Remaining: USER creates
  Zetaris Cloud account + posts help-desk questions.
- **Fri 23**: Zetaris instance up on VPS (user) → onboard 3 sources → federated
  evidence capture path (pinned runs mirroring `graph_runs`).
- **Sat 24**: federated rows become cited brief claims alongside graph rows;
  memory warm-start verified end-to-end; failure/fallback tests.
- **Sun 25**: harden demo path; record 1–4 min video draft; Cursor seat time
  logged for the write-up.
- **Mon 26**: deck + README + sponsor-tech explanation; clean-clone setup test;
  declare pre-existing components (bothy core) in the submission form.
- **Tue 27**: submit EARLY (timestamp tiebreak), verify links, monitor
  announcements.

## Pre-submission checklist (official §6.2)

- [ ] Demo video 1–4 min uploaded
- [ ] Slide deck complete (problem/user, solution, architecture, stack,
      sponsor usage, uniqueness, visuals, roadmap)
- [ ] Public repo + README (setup/usage/deps)
- [ ] Sponsor-tech explanation: Zetaris + Meterless + Cursor + NVIDIA
- [ ] Pre-existing components declared in the form
- [ ] No committed secrets; `.env.example` placeholders only
- [ ] Submitted before 27 Oct 23:45 UTC

## Submission checklist

- [ ] 1–4 min demo video: main workflow, how the agent answers the challenge,
      Zetaris + Meterless integration visible.
- [ ] Deck: problem/user, solution, agent architecture, stack, sponsor usage,
      what was unique, product visuals, roadmap.
- [ ] Public repo + README (setup/usage/deps); declare bothy as pre-existing.
- [ ] Written sponsor-use explanation (Zetaris, Meterless, Cursor, NVIDIA).
- [ ] Track selected in workspace (T02 unless help desk says otherwise).
