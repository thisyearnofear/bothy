# Nebius × NVIDIA: the same programme-impact workflow

Decision date: **3 October 2026**. EDTH first; Nebius follows without creating a
second product. Product: [accountable programme-impact briefs](product-vision.md).

## Rules and what is actually verified

Official rules: https://nebiusglobalaihackathon.devpost.com/rules
Resources: https://nebiusglobalaihackathon.devpost.com/resources

Public rule search on 3 October returned a submission window of **26 August to
30 October 2026, 10:00 Pacific Time** (17:00 UTC on that date). Re-check the
official rules and timezone before submission. The repository's earlier fit
analysis is not an organizer eligibility ruling.

| Requirement / evidence | Current boundary |
|---|---|
| Run on Nebius Token Factory or AI Cloud + use an NVIDIA open-source model | Opt-in provider wiring is the first step. Actual eligible model availability and successful inference are still required. |
| Working public demo | Existing deployment references do not prove the new defence route is deployed or healthy. Rehearse before claiming it. |
| Public repository / license / setup | MIT repo exists. Fresh-clone graph setup and no-private-key fallback must be rehearsed. |
| Public video and submission fields | Prepare after the end-to-end journey works; confirm exact duration/fields with current rules. |
| Existing project / submission-period delta | Record dated work against a baseline in `execution-log.md`; confirm reuse rules rather than assuming eligibility. |

Candidate track: **Best Apps and Agents**, subject to the current organizer
categories. Do not count a provider stub or unused model call as the integration.

## Technical plan

1. Configure a server-only `nebius` provider with `NEBIUS_API_KEY`,
   `NEBIUS_BASE_URL`, and an explicitly selected `NEBIUS_MODEL`.
   Verify the model identifier and NVIDIA provenance in the current model
   catalogue; do not guess a Nemotron SKU or silently use another vendor.
2. Use the provider for the same primary-gallium programme-impact brief.
   Evidence comes from a pinned graph run; the model explains, does not invent
   dependency rows, risk scores, or an authorized decision.
3. Bound turns, total latency, retries, and tool access. Fix the Strands result
   handoff and avoid duplicate review persistence before the live demo.
4. Compare against the scripted baseline: evidence coverage, unsupported claims,
   median/p95 brief latency, and fallback behavior. Report actual measurements.
5. Rehearse provider unavailable → labelled scripted fallback → review still
   pending → no external dispatch.

Provider wiring is not a finished defence/Nemotron agent. The current generic
agent remains road-oriented until the defence brief delivery gate is completed.

## Connected mode is not offline mode

Token Factory is **cloud inference**. It cannot make an offline/DIL claim true.
Use only synthetic/public demo data until the buyer authorizes model egress.
Private/offline deployment requires local inference or deterministic processing,
local evidence storage, and an explicit offline validation run.

## Scope and sequencing

- EDTH: graph exposure + native versioning + honest evidence artifact.
- Nebius: complete the cited brief/review journey, then show actual NVIDIA
  inference on Nebius and comparative quality/reliability evidence.
- Do not add Tavily just to chase a prize. Research context is score-neutral,
  frozen, and separate from operational evidence if it earns a later place.
- Preserve the no-key scripted path. Do not run paid inference, publish a demo,
  upload customer data, or submit on behalf of the team without authorization.

Deliverables: reproducible README, graph setup, `.env.example` placeholders,
end-to-end tests, connected-mode inference evidence, a public demo/video after
approval, and the dated submission delta.
