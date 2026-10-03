# Flood resilience: operator validation brief

Date: 2026-10-03
POC: Product owner to nominate an operator and research lead.
Status: Prepared for discovery; no operator consulted or workflow validated.
TL;DR: Test one hypothesis: a route or asset duty officer can make and track a better protective decision when evidence, authority, response ownership, and reassessment remain in one case. The seeded flood demo is an interview aid, not operational evidence.

## Proposed first scope

Candidate user: the duty officer responsible for one flood-exposed route or asset. Candidate decision: whether to issue a warning or request/authorize an access restriction under that operator's existing rules. Treat both the user and decision as hypotheses until the operator confirms them.

This scope builds on the route-risk demo. It does not cover catchment engineering, drainage investment prioritization, forecasting flood extent, or autonomous closures. If the selected partner needs one of those, rewrite the scope before implementing live feeds.

## Interview and walkthrough

Ask the operator to walk through a recent decision using records they are permitted to share. Record the following without importing sensitive data into a public demo:

1. Who noticed the condition, who made the decision, and who could authorize or execute the response?
2. What evidence mattered: gauge observations, forecast, official warning, inspection, route status? Which sources were stale, missing, or conflicting?
3. What triggered escalation, no action, restriction, or stand-down? Which thresholds are local policy and which require judgment?
4. How did a task reach the response owner? What established receipt, acknowledgment, execution, and inability to execute?
5. How did the duty officer reassess conditions? What established safe reopening or closure of the case?
6. How long did each step take? Where did handoff errors, repeated work, or uncertainty occur?
7. What access, retention, export, hosting, and audit requirements apply?

Use the seeded replay only to discuss layout and evidence categories. Explicitly state that its thresholds and gauge-like values are illustrative. Do not ask a participant to make a real protective decision from the demo.

## Candidate task script

Present an approved anonymized reference incident or a clearly synthetic exercise. Ask the duty officer to identify freshness/coverage limits, select the affected route/asset, propose the permitted response, record a reason, and assign responsibility. Ask the response owner to acknowledge, record execution or inability to act, and supply an observation. Return to the duty officer for reassessment and stand-down/escalation.

Include stale data, conflicting sources, no-action reasoning, failed delivery, unacknowledged task, wrong authority, and conditions that change after approval. Keep observation time, retrieval time, forecast validity, and replay cursor distinct.

## Decisions required before implementation

| Decision | Evidence to obtain | Current status |
|---|---|---|
| Named user and sponsor | Operator confirmation of recurring responsibility | Unknown |
| One route/asset and action | Real process and authority boundaries | Unknown |
| Data and freshness contract | Approved sources, update intervals, stale-data behavior | Unknown |
| Escalation and stand-down | Local policy and responsible decision-maker | Unknown |
| Response handoff | Delivery, acknowledgment, execution and verification process | Unknown |
| Privacy and deployment | Approved data handling, access, hosting and retention | Unknown |
| Success target | Baseline process and agreed improvement measure | Unknown |

## Acceptance proposal to agree with the operator

- An authorized user can explain why attention is needed and identify stale/missing evidence without assistance.
- The proposed action matches that operator's authority and response process.
- Wrong-role actions are refused; decisions, rationale, and subsequent reassessments are recorded.
- Notification queued, delivered, acknowledged, executed, and verified remain separate states.
- Stale/failed sources and failed handoffs remain visible and recoverable.
- Compare time to an authorized decision, handoff completion, interpretation errors, and reassessment effort with the current process. Agree numerical targets only after measuring a baseline.
- Recorded execution or outcome does not establish prevented harm. Any claim about effectiveness requires a separately agreed evaluation.

## Deliverables and next decision

Produce a reviewed journey map, authority matrix, evidence/freshness contract, and a scoped acceptance checklist. Log disagreements and missing evidence. The product owner then decides whether to build an operational flood pilot, revise the scope, or keep flood as a demonstration.

No outreach, live integration, operational recommendation, customer import, or deployment has been performed. Buyer contact and data use require explicit approval and a nominated partner.

See [domain workspaces](domain-workspaces.md) for the platform/domain split.
