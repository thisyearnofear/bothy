# Defence workspace: first implementation slice

Date: 2026-10-03
POC: Implementation owner to be assigned.
TL;DR: Implemented clear catalogue states, a captured-evidence gallium summary, brief-first ordering, case-stage feedback, and corrected landing copy. Local tests and production build pass; browser checks used synthetic responses for the successful analysis.

## Changes

- Catalogue loading, ready, empty, and unavailable states are distinct. Reconnect refreshes questions, graph health, and session without clearing captured evidence.
- Connection and operation details sit behind disclosure. Graph failures use analyst-readable copy.
- Gallium summaries count distinct usable platform names from captured rows. They disclose unknown coverage, the 50-row limit, missing names, and the absence of returned dependency paths or programme identities.
- Summary and brief precede captured evidence and exports. Raw rows are collapsed by default.
- Brief stages show analysis, pending review, rejection, assignment, acknowledgment, and recorded outcome. Disabled review and owner actions explain required permissions.
- Landing copy describes locally implemented review/action foundations and outstanding buyer validation.

## Verification

- Web tests: 73 passed, including six new summary/catalogue/stage tests.
- Agent tests: 20 passed.
- Typecheck passed.
- Lint: zero errors; existing unused `compact` warning in `CaseList.tsx` remains.
- Production web build passed.
- `git diff --check` passed.
- Actual backend-unavailable browser state settled to "Exposure questions unavailable" with collapsed diagnostics.
- Browser-tab-only synthetic responses verified reconnect recovery and an analysis with duplicate rows: three rows produced two observed platform names.
- At 390px width, page width remained 390px; the brief preceded export and captured rows were collapsed.

The successful browser analysis was a fixture rehearsal, not a live TuringDB or authenticated review test. No graph data, identity configuration, external dispatch, deployment, or paid inference was changed. The production build regenerated the previously modified framework type-reference file back to its tracked state.

## Follow-up

[Slice two](defense-workspace-slice-two.md) subsequently implemented citation
inspection, typed recovery, and synthetic-demo case access. The list below records
what was outstanding when slice one completed.

## Remaining work at slice-one completion

- Clickable citations and identity-checked row highlighting.
- Complete typed auth/permission/conflict recovery and saved-brief return journeys.
- Case-level authorization before eligible-person endpoints and saved-case queues.
- Persisted deterministic brief synthesis remains unchanged; this slice adds a UI summary of the captured run.
- Automated browser coverage, comprehensive accessibility checks, and real buyer identity/data validation.

See [the implementation plan](defense-workspace-implementation-plan.md) for dependencies and acceptance criteria.
