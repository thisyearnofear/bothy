# Bothy: accountable programme-impact briefs

Decision date: **3 October 2026**. This is the forward product direction.
The winter-road and flood demos remain historical proof cases, not parallel
go-to-market priorities.

## One buyer, one recurring decision

**Primary user:** a supply-chain analyst at a European defence prime.
**Pilot sponsor:** the programme / supply-chain resilience lead.
**Decision:** when a supplier, material, or transit lane is disrupted, which
programmes are exposed, what evidence supports that conclusion, and who owns
the next action?

> Turn a supply-chain disruption into a review-ready, auditable programme-impact
> brief, without losing the evidence or the person responsible for the decision.

Military logistics cells are design partners and a later deployment channel.
Energy operators, winter-road teams, and humanitarian logistics are expansion
candidates, not additional buyers to build for now.

## The workflow we are building

Disruption → version-pinned dependencies → affected programmes → cited brief →
authorized review → assigned action → acknowledgment → recorded outcome.

The first demo uses **primary-gallium exposure**, with a Taiwan Strait scenario
as a second example. A dependency is evidence of exposure, not proof that a
programme stops: inventory, substitutes, timing, and missing relationships must
remain explicit. Query row limits are samples, not total blast-radius counts.

## Review baseline

These are qualitative engineering/product ratings, not customer research.
Browser layout checks used isolated fixtures when the local API failed;
screenshot capture was unavailable, so the UI rating is provisional.

| Area | /10 | Main insight |
|---|---|---|
| Product design | 8 | Replayable evidence is stronger than another alert dashboard. |
| UI / design system | 7.5 | Coherent visual language; faint operational text needs more contrast. |
| UX | 6 | Decision competes with diagnostics, subscriptions, and marketing. |
| Wedge | 6 | Two narratives obscure the buyer and recurring decision. |
| Architecture | 6 | Good primitives; graph and road workflows are not yet one accountable loop. |
| Production readiness | 3.5 | Identity, isolation, dispatch, and provenance need enforcement and tests. |

Keep deterministic scoring, frozen evidence, replay boundaries, and optional
LLM assistance. Stop prioritizing cinematic polish, more scenarios, or query
speed ahead of decision usefulness.

## Trust contract

- A browser-provided name is not authenticated authority. Production review
  needs identity, roles, ownership checks, and controlled state transitions.
- A graph export is **unapproved analysis**, not a signed intervention. Hash
  linkage detects changes relative to a retained trusted hash; it does not prove
  source truth, authorization, or immutable storage.
- Capture graph, query, scenario, retrieval time, result count, and source
  boundary on the server. Next add commit pinning and an assessment/model
  version before calling the artifact a reproducible decision record.
- Email dispatch must require an approved assessment. Rejected/pending drafts
  must never reach the external sender. Separate internal review requests from
  external advisories when those channels are designed.
- Read-only graph queries and temporary simulations need enforced boundaries
  and request-scoped graph/commit/change state, not comments or prompts.
- No background monitoring claim until a worker, deduplication, retry policy,
  and observable freshness have been implemented.
- Scores are heuristic indices, not calibrated probabilities. Illustrative
  lead time is not a predictive backtest; “inevitable” is not acceptable copy.

## Interface contract

The primary door is `/defense`, independent of the Postgres road catalogue.
The first screen answers **what is exposed, why, and what happens next**.
Evidence and the result share one workspace. Diagnostics, raw Cypher, benchmarks,
and commit controls use progressive disclosure. Pilot marketing belongs on the
landing/pilot surfaces, not inside the operational decision rail.

Keep colour + severity labels, system fonts, visible keyboard focus, native
scroll, and reduced-motion behavior. Meaningful small text must meet 4.5:1
contrast. Mobile must put the result/decision before explanatory machinery.

## Pilot: prove usefulness, not milliseconds

Indicative pricing remains **€15k / two weeks**, not validated willingness to pay.
Scope one buyer-approved BOM/lane dataset and one recurring impact question.
Agree acceptance criteria before importing customer data:

1. An analyst checks the dependency results against a supplied reference set.
2. Report completeness, incorrect dependencies, and known coverage gaps.
3. Measure median time from disruption to a review-ready brief against the
   buyer's current process; set the improvement target with that buyer.
4. Every brief identifies its evidence version and records review and action
   ownership. No silent fallbacks or fabricated certainty.
5. Buyer data handling, hosting, model egress, and export-control constraints
   are explicitly approved. No sensitive customer data in public demos.

## One product, two hackathon demonstrations

**European Defense Tech Hackathon / TuringDB track:** exposure reasoning plus
replay / branch / diff on versioned graph data. Show one useful operator journey,
synthetic-data caveats, and the actual weekend contribution.

**Nebius × NVIDIA:** the same workflow, with an actually exercised NVIDIA model
on Nebius. Show cited brief quality, latency, and safe failure relative to the
scripted baseline. Cloud inference is connected mode, not an offline capability.
Opt-in provider configuration is not proof of an eligible live integration.

Do not add Tavily or another prize-driven integration unless it improves this
workflow and clears the existing intake/data-handling contract.

See [roadmap.md](roadmap.md) for delivery gates and the two hackathon documents
for submission evidence. Do not deploy, publish, contact buyers, or run paid
inference merely because those integrations are configured.
