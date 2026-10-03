# Defence workspace implementation plan

Date: 2026-10-03
Status: Partially implemented following user authorization. Remaining slices are planned.
POC: Product owner to confirm; technical lead to assign implementation owners.
TL;DR: Finish one readable gallium case, make evidence navigable, and make review and follow-up discoverable. Establish case-level access before adding saved-case queues. Validate the resulting journey with synthetic fixtures, then with an approved buyer identity provider and dataset.

## Goal and boundaries

The primary user is a supply-chain analyst at a European defence prime. The release should let that analyst analyze a disruption, understand the captured exposure, prepare a cited brief, obtain review, and track an assigned verification through its recorded outcome.

Retain the current visual language, deterministic generation, pinned evidence, strict state transitions, and fail-closed authentication. Treat dependencies as exposure, never proof of stoppage. Treat owner-recorded outcomes as observations, never independently verified effectiveness.

This plan addresses the review of product design, UI/UX, and progress against the vision. It does not authorize deployment, buyer contact, customer-data import, external messages, identity-provider changes, or paid inference. Winter-road expansion, new graph scenarios, cinematic polish, and live model integration are outside the first release.

## Implementation status: 3 October 2026

[Slice one](defense-workspace-slice-one.md) implements catalogue recovery, landing
copy, a UI-derived gallium summary, and brief-first ordering. [Slice two](defense-workspace-slice-two.md)
adds stored-row citation navigation, typed recovery, and synthetic-demo case
access. Verification totals are 76 web tests and 21 agent tests.

The deterministic persisted brief generator is unchanged. Person selection,
saved-case queues, customer tenancy, indexed list storage, committed browser
coverage, and buyer validation are not implemented. The steps below retain the
original delivery plan and acceptance criteria; implementation notes identify
which parts have actually been verified.

## Implementation baseline before these slices

- `apps/web/components/GraphPanel.tsx` owns scenario selection, captured rows, exports, and advanced controls.
- `apps/web/components/DefenseBriefPanel.tsx` owns draft, reopen, review, assignment, acknowledgment, and outcome UI.
- `apps/agent/src/defense.ts` generates deterministic claims and persists briefs/audit records in SQLite.
- `packages/shared/src/types.ts` defines captured-run, claim, and brief contracts.
- `apps/web/lib/api.ts` provides browser API methods.
- `apps/web/lib/defenseProxy.ts` strictly limits browser-to-agent routes and bodies.
- Existing tests cover authenticated transitions and the browser bridge. The review reran 67 web tests and 20 agent tests successfully.
- The live visual review covered desktop/mobile empty and service-unavailable states. The authenticated happy path still requires a real browser rehearsal.

Three constraints affect sequencing:

1. Brief generation currently formats up to five captured rows as claims. It needs scenario-aware synthesis and a visible statement of how much evidence the brief represents.
2. There is no saved-brief list API or person directory. Assignment validates a subject against configured owner roles.
3. Per-ID brief/evidence/audit reads check roles but do not currently show per-case ownership or tenant scoping. A queue must not expose a broader collection under that same coarse check.

## Delivery sequence

| Slice | Deliverable | Depends on | Exit evidence |
|---|---|---|---|
| 0 | State model, access rules, fixture set, layout sketch | None | Reviewed contracts and synthetic cases |
| 1 | Settled service errors and accurate product copy | Slice 0 state model | Error/retry and sign-in return tests |
| 2 | Analyst summary, unified case layout, clickable evidence | Slice 0 evidence contract | Gallium journey and citation browser checks |
| 3 | Case authorization, eligible owner selection, saved-case queues | Slice 0 access rules; slice 2 case UI | Isolation, migration, pagination, and owner tests |
| 4 | Release rehearsal and accessibility verification | Slices 1 through 3 | Recorded desktop/mobile workflow and checks |
| 5 | Buyer identity/data validation and usefulness pilot | Slice 4; explicit buyer approval | Agreed reference-set and timing report |

Slices 1 and 2 can proceed in parallel after contracts are agreed. Storage/access work for slice 3 can proceed alongside them, but queue endpoints must not ship before access tests pass. Slice 4 is the integrated prototype release boundary. Slice 5 has external dependencies and is not included in a local implementation-complete claim.

## Slice 0: agree the case and evidence contracts

Product and technical owners should approve:

- A case stage model derived from existing server states: analyzed, drafted/awaiting review, rejected, approved/awaiting assignment, assigned, acknowledged, outcome recorded.
- A distinction between case stage and service/session status. Graph failure must not imply that a saved case was deleted.
- A deterministic summary contract: observed programme entities, captured dependency paths, captured row count, evidence version and retrieval time, query limit if known, generation coverage, and known gaps.
- An access matrix covering creator, reviewer scope, assigned owner, and administrators if required. Define who may read brief, evidence, audit, list metadata, or assign owners.
- A bounded source of eligible people for assignment. Start with administrator-configured principals and optional approved display names. Do not assume an identity-provider directory exists.
- A layout sketch with the case summary and next action ahead of exports and diagnostics.

Fixtures must include multiple dependencies for one programme, null/missing programme IDs, zero rows, a limited result, more than 50 captured rows, pending/rejected/approved briefs, and all action states.

Acceptance: no count or coverage percentage is derived from an unknown denominator. Results that hit a query limit are described as potentially truncated unless the server can establish truncation. Distinct programme counts are explicitly limited to identifiable entities present in captured evidence.

## Slice 1: fix failures and return journeys

Targets: `GraphPanel.tsx`, `DefenseBriefPanel.tsx`, `apps/web/lib/api.ts`, `apps/web/app/page.tsx`, and existing session/proxy/bridge tests.

Implement explicit catalogue states: loading, ready, empty, unavailable. Replace persistent "Loading questions..." after a failure with a settled unavailable state. Retry should recheck the catalogue and graph health without erasing an existing case.

Use analyst-readable messages, with raw API paths and service details in diagnostic disclosure. Distinguish signed out/expired session, insufficient permission, conflicting transition, unconfigured SSO, and unavailable service. Explain disabled actions beside the control and show saving/saved feedback.

Preserve exact saved-brief context through sign-in and retries. Only accept safe same-origin return targets. Do not silently discard typed review or outcome text on recoverable failure; never persist sensitive text to browser storage by default.

Update landing copy to distinguish locally implemented review/action foundations from outstanding operational validation. Consolidate general prototype caveats into a compact status area; retain exposure/coverage caveats next to relevant claims.

Acceptance:
- Catalogue failure ends loading and offers a working retry.
- 401, 403, 409, and 503 produce different useful states.
- Reauthentication returns to the intended brief.
- Failed mutations do not appear successful or advance the case.
- Scenario changes cannot leave stale summary or brief content presented as belonging to the new run.

## Slice 2: present one analyst-readable case

Targets: shared types, `apps/agent/src/defense.ts`, `apps/agent/src/defense.test.ts`, `GraphPanel.tsx`, and `DefenseBriefPanel.tsx`. New presentation components may be introduced during implementation.

Start with gallium-specific deterministic synthesis. Use scenario-specific field mapping, not guesses about arbitrary table columns. Show an observed programme and the dependency path supporting it, with row citations. Preserve unsupported or incomplete relationships as gaps. State when a preview or brief covers only part of the captured rows.

Recompose the workspace:
1. Compact disruption/scenario context and service status.
2. Exposure summary and current case stage.
3. Brief and the next permitted action.
4. Expandable captured evidence.
5. Export and advanced graph tools.

On mobile, place the brief/next action before export and diagnostics. Keep the current result available while a separate rerun is pending, clearly marked as the previous capture.

Make each citation open and highlight its exact captured row/column. For newly drafted cases, reuse a run only after validating evidence identity. For reopened cases, obtain authorized captured evidence. Do not rerun the graph to reconstruct a citation. Support citations beyond the first 50 displayed rows, keyboard focus, and accessible selection announcements. Put hashes and JSON behind provenance disclosure.

Acceptance:
- Every summary claim is supported by captured evidence.
- Duplicate dependency rows do not inflate observed programme counts.
- Zero rows is never presented as proof of no exposure.
- Evidence identity mismatch or missing evidence blocks claim inspection with an explicit error.
- Every citation reaches the correct row, including one outside the initial table slice.
- An analyst can identify the current stage and next action without reading technical identifiers.

## Slice 3: support ownership and saved-case discovery safely

Targets: `apps/agent/src/defense.ts`, `apps/agent/src/auth.ts`, shared types, `apps/web/lib/api.ts`, `apps/web/lib/defenseProxy.ts`, and agent/proxy/bridge tests.

Implement case access before list endpoints. Persist explicit access scope and creator/owner metadata where needed. Derive authority from the verified principal, never browser-supplied identity. Define safe treatment of existing public/synthetic records and legacy briefs with no creator. Do not infer an owner or tenant during migration.

Add compatible SQLite migrations and bounded, indexed list queries. Suggested initial views:
- Reviewer: cases awaiting review within approved reviewer scope.
- Action owner: own assigned/acknowledged verification tasks.
- Analyst: own accessible saved cases where creator ownership is known.

Return only authorized list metadata. Apply the same policy to per-ID brief, evidence, and audit access so guessing an ID cannot bypass queue restrictions. Update the strict browser proxy route/query/body contract intentionally. Retain no-store behavior.

Provide an authenticated, scoped list of eligible assignment principals. Display an approved name plus a distinguishing identifier; store the stable subject. Preserve server-side eligibility checks, including when a person's role changes after the picker loads.

Acceptance:
- A user outside case scope cannot read the brief, evidence, audit, or list entry.
- Forged owner/filter/subject parameters cannot widen access.
- Migration preserves existing evidence hashes, review history, and action state.
- List pagination is bounded and stable; due times and overdue status are understandable.
- Assignment survives reload and appears in the correct owner's queue.
- Rejected briefs cannot be assigned; duplicate/concurrent transitions remain rejected and audited correctly.

Customer tenancy and private sharing require an approved data/access design. Keep public witness exports limited to synthetic/public evidence until that design is implemented and tested.

## Slice 4: verify the complete prototype release

Use isolated synthetic fixtures and a disposable data directory. Introduce committed browser tests after checking the available browser test tooling; HTTP bridge tests alone do not establish rendered usability.

Required browser journeys:
- Gallium analysis, summary, citation inspection, draft, reviewer approval, assignment, owner acknowledgment, outcome, reload, and queue reopening.
- Rejection, zero rows, potentially truncated results, and evidence beyond the initial visible slice.
- Service unavailable/retry, expired session, wrong role, concurrent review conflict, and saved-case sign-in return.
- Desktop and 390px mobile layout, 200% zoom, keyboard-only use, focus placement after citation navigation, and status announcements.

Check meaningful small text at 4.5:1 contrast, control boundaries/focus contrast, reduced motion, and touch targets. Verify long IDs and table data do not cause page overflow. With a ready fixture, the summary and next action should precede the evidence/export block on mobile.

Run `npm test`, graph-sidecar tests where their dependencies are available, typecheck, lint, web production build, and `git diff --check`. Record skipped checks and their reasons. Review migrations on a copied synthetic ledger and demonstrate restoration to the prior version before changing any retained data.

Release evidence: a dated execution-log entry, desktop/mobile captures, passing negative-access tests, and a reproducible browser rehearsal. Update roadmap statuses only for verified work.

## Slice 5: validate usefulness in the buyer environment

Require explicit approval for identity-provider configuration, hosting, data handling, export-control constraints, and any model egress.

Exercise the real identity provider with agreed roles. Agree one reference dataset and impact question before import. Have the buyer check incorrect dependencies, completeness, and known gaps. Measure median disruption-to-review-ready-brief time against the existing process and agree the improvement target with the buyer.

Owner-recorded outcomes remain distinct from validated operational effects. Downloads, signup counts, and synthetic latency do not establish usefulness.

Freshness, deduplication, retries, operational observability, and private sharing remain separate pilot prerequisites. Live Nebius/NVIDIA evaluation follows only with authorization and an agreed comparison against the deterministic baseline.

## Success measures and scope control

For the prototype release, require correct evidence navigation, understandable stage/permission feedback, durable reopen/queue behavior, and passing authorization/transition tests. Measure task completion, analyst interpretation errors, citation lookup effort, and time to prepare/review a brief with representative users.

Do not claim a usability improvement solely because tests pass. Record observations and disagreements from analyst sessions. Open separate follow-up work for additional scenarios, notifications, live inference, and freshness infrastructure.

Before implementation starts, assign owners and estimate each slice after approving the summary contract and access matrix. The buyer/IdP work has an external lead time and should be tracked separately from engineering effort.

## References

- [Product vision](product-vision.md)
- [Design guidance](design.md)
- [Roadmap](roadmap.md)
- [Execution log](execution-log.md)
- [Pilot acceptance](pilot-one-pager.md)
- [Operating boundaries](ops.md)
