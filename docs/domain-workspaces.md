# Domain workspaces and accountable cases

Date: 2026-10-03
POC: Product owner to confirm the flood design partner and protective decision.
Status: Accepted product direction; implementation is incremental.
TL;DR: Bothy shares an evidence-and-action case model across purpose-built domain workspaces. Defence is the active product. Flood resilience is a scoped discovery track with an existing seeded replay, not an operational prevention service.

## Product organization

Keep `/defense` as the main product entry and `/watch?case=flood` under earlier proof cases. Do not mix flood and gallium in an exposure-question selector. A future flood workspace needs a validated operator, recurring decision, data contract, and authority model before it becomes a second operational product door.

Shared case concepts are identity, responsible people, stage, cited evidence, recorded decision, action ownership, acknowledgment, due time, and outcome. Shared UI conventions include evidence inspection, permission feedback, audit history, and saved-case discovery. These are a product contract; this increment does not merge existing databases or install a common workflow engine.

Keep domain evidence and transitions separate. Defence uses graph dependencies and pinned captures; flood uses geographic assets and time-sensitive observations, forecasts, official warnings, and field status. An approved verification brief does not authorize a road closure. Delivered notification does not establish receipt or executed protective work.

## Defence journey

An analyst investigates a disruption, inspects captured exposure and gaps, drafts a cited brief, and obtains reviewer approval or rejection. A reviewer assigns an eligible verification owner and due time. The owner acknowledges, checks inventory/alternatives/timing, and records findings. The saved case retains its original evidence; a separate analysis does not silently replace an approved record.

Current implementation adds an access-scoped saved-case collection, bounded pages, configured owner selection, and a dedicated reopen view. Reviewers see the synthetic demo collection; analysts see their own created cases; action owners see assigned cases. Multiple verified roles combine those permissions. This remains a prototype synthetic access policy, not customer tenancy.

The collection shows status and due/overdue work, with role-scoped views for awaiting review, awaiting assignment, and the current owner's active verification work. Accessible analysts/reviewers can recapture the same exposure question into a linked pending revision. Parent evidence, review, action, and audit remain unchanged; revisions inherit no approval or action. A revision links back to its parent, whose access is checked separately. Branches are permitted; there is no automatic supersession or consolidated revision history yet.

Stable cursor pagination, notifications, display-name directory, revision-history navigation, and customer scope remain follow-up work. Offset pages use a deterministic creation-time/id order but may shift when new cases arrive.

## Flood resilience journey to validate

The [operator validation brief](flood-operator-validation-brief.md) provides an interview script, task exercise, authority/data questions, and acceptance proposal. No operator has been consulted or workflow validated. Choose one route or asset operator and one protective decision. The current demonstration is closest to a duty officer deciding whether route conditions justify a warning or restriction. Drainage/catchment investment planning is a different workflow and should not inherit that decision model without discovery.

The proposed operational flow is: observed condition, exposed route/asset, proposed response, authorized protective action, owner acknowledgment, execution observation, reassessment, and stand-down/closure. Separate no-action decisions from missing data. Separate notification queueing, delivery, receipt, field execution, and verified completion.

The proposed layout uses a priority queue with reasons/freshness, geographic evidence, a persistent decision/action rail, and a timeline. Live operations and replay/training must have distinct mode labels and clocks. Gauge observations, forecasts, official warnings, road status, and verified outcomes must remain separate evidence categories.

Before building live flood operations, agree:
- Named user and authority for the proposed warning/restriction or protective action.
- One asset/route scope and an escalation/stand-down policy.
- Evidence freshness, source coverage, thresholds and uncertainty.
- Case access, data handling, and a transactional decision/audit/dispatch contract.
- Worker, deduplication, retries, delivery/acknowledgment and outcome tracking.
- Acceptance measures based on decision quality and response execution; do not infer prevented harm from an illustrative score or recorded outcome.

## Implementation boundaries

The current flood experience is an authored replay with seeded gauge-like signals and heuristic scoring. It has no live flood worker or validated prevention model. The legacy Postgres road/flood approval/notification path is not replaced by the defence SQLite flow. Existing public exports remain synthetic/public only. No new live feed, deployment, buyer contact, identity configuration, external send, or paid model use is authorized by this document.

See [product vision](product-vision.md), [roadmap](roadmap.md), and [architecture](architecture.md).
