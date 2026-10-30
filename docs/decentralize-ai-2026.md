# Decentralize AI 2026 — bothy Plan

**Event:** Decentralize AI Hackathon (HackerNoon × Nosana × Arweave × MEXC). Two rounds:
- **Round 1:** Jun 1 – **Oct 2026** ← closes *immediately* (today is 28 Oct 2026; claim Nosana credits now).
- **Round 2:** Nov 2026 – Feb 2027 (overlaps Shipyard Make Me Money Nov 2–21).

**Prizes:** $70 Nosana GPU credits for *every* eligible participant; winners get +$450 + Arweave credits + MX tokens; grand prize = ownership of the DecentralizeAI.tech codebase. Submission = **HackerNoon blog post** (`Agentic AI` + `Decentralized AI` + `Open Source` tags) + Nosana claim.

## Layers we hit (FAQ: "tackle at least one layer of open AI infrastructure")

| Layer | bothy mapping | Artifact |
|---|---|---|
| **Verifiable & reproducible AI systems** (headline) | Investigation loop emits cited, version-pinned evidence receipts → `evidenceHandoff.md` | `apps/agent/data/bothy-loop.db`, `apps/agent/src/integrations/`, `apps/demo-video/BRIEF.md` |
| **Data sovereignty tooling** | OIDC (auth-code + PKCE), encrypted HttpOnly session, user-owned evidence graph | `apps/web` OIDC login page (public URL), `apps/agent/src/integrations/zetaris.ts` |
| **Open inference infrastructure** | `apps/agent/src/agent/providers.ts` — OpenAI-compatible free-first provider chain (Qwen HF, OpenRouter free tier, any OAI base URL, local Ollama) | `providers.ts` |

> Note: Arweave anchoring is wired (`integrations/arweave.ts`, mainnet, graceful-degrade); Nosana deployment is the remaining build.

## Why bothy is the strongest entry (vs. the rest of the repo)

- Its *thesis is verifiable evidence* — the judges' #1 criterion — rather than AI bolted on later.
- Live public URL (OIDC login) + reproducible `apps/demo-video` cinematic slice already satisfy "working code / deployment URL."
- `providers.ts` is already an OpenAI-compatible inference layer — minimal lift to run it on a local Llama 3.1 8B in Nosana's GPU marketplace.
- databard's strength is B2B Stripe revenue (Shipyard) — great for *that* hack, weaker here.

## 7-day plan (Round 2 — Nov 2026)

1. **Arweave permanence** (`apps/agent/src/integrations/arweave.ts`) — after each brief, sign + post the evidence receipt (hash only, per Zetaris pattern) to Arweave; surface the TX id on the CaseStatusPanel.
2. **Nosana GPU** — `Dockerfile` + `nosana.json` (real job-definition spec) running the investigation provider chain (local Llama 3.1 8B fallback in the OAI-compatible chain + Grok vision judge + folio renderer) on a single T4/A10 (16 GB VRAM), per-brief runtime 1–3 h.
3. **Reproducible one-liner** — `docker pull ghcr.io/thisyearnofear/bothy-agent && docker run` that boots a mini Zetaris + the agent + web, then renders a cited brief. This *is* the evidence.
4. **HackerNoon post** — "How bothy makes AI evidence reproducible (and why supply-chain decisions need receipts)," with the Docker run + Arweave tx as proof.
5. **Round-1 fast track (if still open):** claim the Nosana credits *now* and point to the live OIDC login page + the Oct 27 `feat: Nebius FT job…` commit as evidence of ongoing, real development.

## Budget fit (the $100 isn't for this hack, but costs matter)

- Nosana credits cover the GPU hours. No infra spend needed.
- If parallelising with Shipyard: keep Shipyard to **databard** (£100 = Stripe + roast ads), Shipyard-safe and already wired. bothy is the Decentralize AI play.

## Claim-form content (copy-paste)

- **Project Name:** bothy
- **Proposal Description:**

> bothy is an accountable impact-brief agent for programme analysts who must turn a supply-chain disruption into a cited, review-ready brief before the decision deadline — today their evidence is scattered across a curated dependency graph, inventory/ERP extracts, sanctions lists and logistics feeds that were never joined, so the real exposure stays invisible. The *problem* is reproducible decision-making under a deadline; bothy's *answer* is a workflow — exposure → version-pinned evidence → cited brief → authorized review → owned action → recorded outcome — where every finding links to a row- or URL-cited receipt, the OIDC review/approval gate makes the responsible person explicit, and the audit trail stays intact.
>
> For Decentralize AI we harden bothy into *verifiable open infra*. We ship an Arweave adapter that posts evidence receipts (hash-only, no PII) after each brief so any finding is permanently checkable, containerise the OpenAI-compatible provider chain on Nosana GPU (a local Llama 3.1 8B fallback in `providers.ts` + the Grok-vision evidence judge + the folio renderer), and publish a reproducible one-liner — `docker pull ghcr.io/thisyearnofear/bothy-agent && docker run` — that boots a mini Zetaris + agent + web and renders a cited brief end-to-end. Public URL is the OIDC login page; git history from this week proves real, active development. Layers hit: verifiable & reproducible AI, data sovereignty, open inference.

- **GitHub Repository URL:** https://github.com/thisyearnofear/bothy
- **Model / Workload Details:**

> Runtime = the OpenAI-compatible provider chain in `apps/agent/src/agent/providers.ts`. New this cycle: a local Llama 3.1 8B Instruct (Ollama-compatible) slotted into the free-first chain as the GPU workload, plus the Grok-vision evidence judge and the evidence-folio renderer. Target GPU: one NVIDIA T4/A10 (16 GB VRAM); per-investigation runtime 1–3 h. Bundled as a Dockerfile + `nosana.json` job definition; each brief run = one Nosana deployment, Replica Count 1, ~2 h container timeout to stretch the $70 credit.

- **Nosana Deployment Commitment:** yes
- **Team Members:** @Quincybob (add teammates)
- **Social Links:** @papa (handle/platform to be confirmed)
- **Email:** papaandthejimjams@gmail.com
- **Phone / Country:** fill in before submitting

## Build log (live) — Day 1 (28 Oct 2026)

Arweave anchoring, wired end-to-end and verified. `git -C bothy status` shows these pending (commit as one hunk):

- `apps/agent/src/integrations/arweave.ts` — `buildReceipt()` (hash-only receipt, sha256 of the assessment) + `postEvidenceReceipt()` → **Arweave mainnet** via the real `arweave@2.1.0` client. Graceful-degrade at every step: unset/malformed/invalid `ARWEAVE_JWK`, unfunded wallet, and rejected posts all return `{ posted: false, reason }` — the assessment never fails. Result carries `txId`, `url` (`arweave.net/<txId>`), `digest`, the exact `receipt` posted, and the wallet `address` + `balanceWinston` when probed.
- `apps/agent/src/integrations/arweave.test.ts` — 4/4 passing: receipt shape, JWK-unset degrade, malformed-JSON JWK, non-Arweave JWK.
- `apps/agent/src/arweaveWallet.ts` — `npx tsx src/arweaveWallet.ts`: validates `ARWEAVE_JWK` (address + AR balance), or generates a fresh JWK to fund when unset.
- `apps/agent/src/server.ts` — `/api/scenario/:scenario/assess` anchors the receipt and returns `{ ...assessment, arweave }`.
- `nosana.json` — real Nosana job-definition (`container/run` op, `expose` 8787 with an `/api/health` check). Replaces the earlier scaffold `nosana.yml`, which was not a valid spec.
- `arweave@2.1.0` added to `apps/agent` deps.

**Verified:** `npx tsx --test apps/agent/src/integrations/arweave.test.ts` → 4 pass / 0 fail; `npx tsc --noEmit -p apps/agent` → clean.

**Corrected course:** the first draft targeted `testnet.arweave.dev` — that host does not exist (Arweave's testing story is `arlocal` / TestWeave, not a public testnet). Mainnet is the better target anyway: a ~300-byte hash-only receipt costs a fraction of a cent of AR, and `arweave.net/<txId>` is *permanently* resolvable — strictly stronger evidence for judges than a testnet tx.

## How a verifier checks a receipt

> Superseded the Day-1 scheme (sha256 of the whole `/assess` response), which could not be re-verified once status/decision fields changed or Postgres reordered keys.

**In the UI:** every assessment (watch room, `/case/<id>`) and defence brief shows a **Permanent public record** card. **Verify** runs entirely in the browser: it fetches the receipt from `arweave.net/<txId>`, recomputes the fingerprint of the record on screen with `crypto.subtle`, and compares the two. Our server is not trusted for the answer.

**By hand:**
1. `GET /api/anchors/assessment/<id>` (or `/api/anchors/defense-brief/<id>`): public, lists the `generated` / `decided` anchors with `txId`, `url`, `digest`.
2. Fetch `url` → receipt `{ v: 2, app: "bothy", kind, subjectId, moment, digest, at, … }`.
3. **Generated:** `sha256(canonicalJSON(assessmentAnchorPayload(record)))` (or `briefAnchorPayload`) from `packages/shared/src/anchor.ts` must equal `digest`. Only immutable fields are hashed, with keys sorted recursively and scores rounded to 4 dp, so the fingerprint survives Postgres round-trips and later status changes.
4. **Decided:** recompute `decisionAnchorPayload` from the receipt's own fields → must equal `digest`. Its `subjectDigest` must equal the generated fingerprint (the chain link; `generationTx` names the earlier tx). `decision` must match the record's status. For defence briefs, `auditHead` must appear in the brief's hash-chained audit log. The reviewer is stored only as `actorDigest` (sha256): committed, not revealed.

## Build log — Day 2 (28–29 Oct 2026)

- **Project wallet created + funded.** `npx tsx src/arweaveWallet.ts` generated a dedicated bothy wallet; `ARWEAVE_JWK` lives in repo-root `.env` (gitignored, loaded by `loadEnv`). Address `xxyrVvBYSyvppbptU0EG1V6h4HMDFCDRW4SRK0hMrik`, funded 0.1 AR.
- **First real mainnet tx anchored.** `src/arweaveSmoke.ts` → `postEvidenceReceipt` → **`gDFj0KEiW8S4v0BCABkqmyJEfiPNs-3WRyDAaJVoRSs`**, mined at block **2031528**. `/tx/<id>` confirms `data_size: 168` with `data_root` committed + all tags (`App-Name`, `Scenario`, `Digest`, `Bothy-Source`). Gateway data-body lags a few minutes behind mining — normal.
- **Postgres resolved without new infra.** `DATABASE_URL` was never a local Postgres — `scripts/db-tunnel.sh` forwards `localhost:5433` → `nuncio-vultr:15432` (PostGIS container on the server's loopback). The tunnel was simply down; re-running the script fixed `/assess` instantly. (Earlier note about needing Supabase/local PostGIS: unnecessary for local dev — still worth a cloud `DATABASE_URL` later for the Nosana deploy, since `localhost` is dead inside a Nosana container.)
- **Real assessment anchored end-to-end.** `POST /api/scenario/flood/assess` (scripted engine) → assessment `a-flood-r-A6108-1793303198574` → **`_GL3NfzIDILsqLrid_oYZH7J71oV4D121oBnLcs2MII`** on mainnet, mined at block **2031535**, digest `6495cd8f…` = sha256 of the returned assessment. The smoke tx's data body is now publicly servable (`curl -L https://arweave.net/gDFj0KEiW8S4v0BCABkqmyJEfiPNs-3WRyDAaJVoRSs` returns the receipt JSON). Gotcha found: the dev server loads `.env` at boot — after adding `ARWEAVE_JWK` you must restart (or touch a watched file under `tsx watch`) or receipts degrade to `ARWEAVE_JWK not set`.
- Note: `gallium-exposure` in the Day-1 plan was aspirational — real seeded scenario ids are `backtest`, `flood`, `live`.

## Build log — Day 3 (30 Oct 2026): anchoring in the product

Judges explore the UI, not the API, and the UI never showed anchoring. The watch room's main button (`/assess/stream`) didn't even anchor, and receipts weren't persisted. Now:

- **Both surfaces, both moments.** Watch-room assessments and defence briefs each get a `generated` receipt (output existed unaltered at time T) and a `decided` receipt (what a named human approved or rejected, and when). The decided receipt chains to the generated one via `subjectDigest` + `generationTx`; defence decisions also pin the audit-chain head.
- **`packages/shared/src/anchor.ts`:** canonical payloads shared by agent and browser so both compute the same fingerprint.
- **`apps/agent/src/anchors.ts` (`AnchorStore`):** an `evidence_anchors` table in the loop SQLite DB; `pending → anchored | failed`. Idempotent (an anchored key never re-posts), dedupes concurrent calls, never throws. Streaming assess, decisions and defence draft/revise/review anchor in the background; `/assess` still awaits. Public `GET /api/anchors/:kind/:id`.
- **`integrations/arweave.ts`:** now a generic `postReceipt(receipt, tags)` poster (15s timeout; tags `Kind`/`Moment`/`Subject`/`Digest`).
- **`apps/web/components/AnchorCard.tsx`:** placed in the watch-room detail, `/case/[id]` and `DefenseBriefPanel`. States: anchoring → anchored (tx link + **Verify**) / failed. Verify results: ✓ match, ✗ mismatch (names the failed check), or "gateway still propagating" (receipt data lags mining by minutes, sometimes longer).
- **Live proof (mainnet):** assessment `a-flood-r-A6108-1793360124563`: generated `gAOkipv1bxKHKoQyBqdl_Mc-MsjWsiPB_F9TijJpOZY` → decided `L3zPHFVL3BwtWVz45wTN17eK89Z0sU924Eg6Yf-Wfg0`, both "✓ Matches the record on screen" on `/case/<id>`. Defence brief generated `65625cHPUXTju_TfrUamU78NKsva86R6pqj0CNy-40M`. Watch-room stream run `asc4am2Vwedx5pV_nQVfRS22AyvAZCZmkUixcMZGOEU`. A digest recomputed from the stored Postgres row equals the anchored digest.
- **Tests:** agent 66/66, web 150/150, typechecks clean.
- **Not yet exercised over HTTP:** `POST /api/assessments/:id/decision` (needs reviewer OIDC, not configured locally). The same anchoring code was run directly against real Postgres + mainnet.

## Next — Day 3 (30 Oct)

- **Decide the deployed demo's wallet story.** Without `ARWEAVE_JWK` the Nosana instance's cards read "Not anchored — this deployment has no project wallet configured", which is what judges would see. Options: a Nosana confidential job/secret holding a low-balance key, or steer judges to `/case/<id>` links for already-anchored records.
- **D3 — Nosana.** Claim credits → `docker build -f apps/agent/Dockerfile -t ghcr.io/thisyearnofear/bothy-agent:latest .` → make the GHCR package **public** → `nosana job post --file nosana.json` (or deploy.nosana.com) → run the same seeded assess through the deployed endpoint → screenshot the deployment + tx.
  - **Never put `ARWEAVE_JWK` in `nosana.json`** — job definitions are published to public IPFS; a JWK there is a leaked private key. Leave it out for the CPU deployment (receipts degrade gracefully), or use a Confidential Job / dashboard secret if the deployed instance must anchor.
  - GPU/local-Llama swap is the next milestone after the CPU replica proves the deploy path.

