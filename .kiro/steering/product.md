# Bothy product and demo contract

Bothy is an accountable winter-access decision-support system for UK upland roads.
It turns fragmented weather, road, terrain, and incident signals into a
route-specific, evidence-backed **draft** for a named duty officer. It is not a
chatbot, a weather app, a dispatch system, or an autonomous publisher.

## Non-negotiable demo claims

- Explain every displayed risk score through timestamped `EvidenceCitation`s.
- Preserve the visible flow: detect → retrieve → reason → recommend → human approval → audit.
- Keep route-level reasoning specific; do not replace it with regional summaries.
- A decision must name the responsible actor and remain pending until a human approves or rejects it.
- The scripted agent is a deliberate, deterministic demo path. Treat an LLM as optional enhancement, never a dependency.

## Replay honesty

- `backtest` is illustrative decision replay, not retrospective model validation.
- The agent horizon is a hard boundary: never expose post-horizon events or outcomes to assessment logic.
- Do not introduce hindsight, leaked outcomes, or live provider data into a backtest.
- Keep historical source caveats visible in the UI and documentation.

## External context

- Live provider data is operator-triggered context, not risk evidence.
- Persist external data with provider, source URL, observation/fetch/ingestion timestamps and payload provenance.
- UI and agent assessment read frozen snapshots from the database; they must not fetch providers during rendering or assessment.
- External context must not change seeded signal events, deterministic scores, citations, causal chains, or replay inputs unless an explicit, separately designed scoring integration is requested.
