# Nebius × NVIDIA Global AI Hackathon — fit analysis

> Source: Devpost (Nebius × NVIDIA Global AI Hackathon), deadline **30 Oct 2026
> 17:00 GMT** — 28 days out. **Sequential, not conflicting: EDTH is this weekend,
> Nebius is after.** Recommendation below.

## Verdict

**Do it — after EDTH.** Same repo, second shot at ~$20k headline + $3k Tavily +
4× track winners (Jetson Orin Nano). Integration cost is ~20 lines for the model
provider. Do not start it before the EDTH deck is submitted.

## Requirement fit (checked against this repo)

| Requirement | Our status |
|---|---|
| Run on **Nebius Token Factory or AI Cloud** | ✅ provider chain in `apps/agent/src/agent/providers.ts` is already OpenAI-compatible — a Nebius Token Factory endpoint is one more `ProviderDef` |
| Use ≥1 **NVIDIA open source model** | ✅ add Nemotron (3 Ultra for reasoning / Nano or Super for cheap calls) as a provider entry |
| Working demo URL | ✅ deployed agent + `site.url` in `apps/web/lib/site.ts`; runbook below keeps it reproducible |
| Public repo + open-source license at top of page | ✅ MIT `LICENSE` at repo root |
| README with setup instructions | ⚠️ **needs work** — `scripts/venue.sh` (4-service one-command start) becomes the README's "run it" section |
| 3-min public YouTube demo | ⚠️ reuse a cut of the EDTH demo video, retold for Nemotron + Cypher |
| Pre-existing project → write what changed in the Submission Period | ✅ already written: the TuringDB defense graph layer is the delta (see [hackathon-turingdb-defense.md](hackathon-turingdb-defense.md) § weekend bright line) |

## Best track: **Best Apps and Agents**

"An app or agent someone would actually use… power it with Nemotron on Nebius
through Token Factory." Bothy is exactly that: a draft→approve→audit agent over a
versioned graph, with a guided scenario desk. Coding-and-Agentic and Personal-AI
are worse fits; Physical AI is out (no hardware).

## Synergies (why this strengthens, not dilutes)

1. **Same demo, two prize pools.** The 8-scenario catalogue, witness-packs, and
   guided mode are already built and verified — Nebius reuses them wholesale.
2. **Nemotron hardens the EDTH DIL story.** A Token-Factory model in the provider
   chain is a concrete answer to "does it work offline?" — worth saying in the
   EDTH pitch even before Nebius judging.
3. **Best Use of Tavily ($3,000) is a clean product fit.** We already used Tavily
   for market + open-source research. To win it, put it *in* the product as a
   **non-evidentiary** `search_context` tool — same contract as the existing
   `get_live_weather_snapshot`: source + timestamp, score-neutral, never cited as
   evidence. That preserves "reports, not media."
4. **Public-repo requirement fixes our graphs problem.** `graphs/` is 465MB and
   gitignored. For a self-contained public repo we ship the pack's MIT generator
   (`scripts/generate_supply_chain_deep.py --scale 0.1`) so a fresh clone builds
   a small demo graph — which also makes EDTH reproducible.

## Scope if we take it (≈3 days, after EDTH submission)

1. **Nebius provider** (`providers.ts`): one `ProviderDef` + `NEBIUS_*` env vars,
   read by the existing chain. No agent-loop changes.
2. **Tavily `search_context` tool**: read-only, explicitly non-evidentiary;
   surfaced in the Strands tool list with a "score unchanged" line; the
   provenance guard already blocks drafts without cited sources.
3. **README runbook**: `bash scripts/venue.sh` + graph fetch/generate + env vars,
   in the "clear guidance for running your project" shape the rules ask for.
4. **Submission paragraph**: what changed in the Submission Period (graph layer,
   provider, tool) + feedback on Token Factory / Nemotron.

## Sequencing / risks

- **Time split.** EDTH = this weekend. Nebius = 30 Oct. Gate Nebius on the EDTH
  deck + demo video being submitted first.
- **Competition.** 16k participants vs EDTH's 4 teams — different odds; do not
  let it creep into EDTH focus.
- **Cost.** Token Factory credits for the reasoning path; keep the scripted brain
  as the failsafe (already built, roadmap §1).
- **Two narratives.** Same code, two stories: EDTH = defense/logistics +
  versioned audit; Nebius = agentic + Nemotron + Tavily.
