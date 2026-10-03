# Defence workspace: citations, recovery, and case access

Date: 2026-10-03
POC: Implementation owner to be assigned.
TL;DR: Added clickable captured-evidence citations, status-specific recovery, and a synthetic-demo case access policy. Owner directory and saved-case queues remain follow-up work.

## Implemented

Citation buttons fetch evidence through the authenticated case endpoint. The server validates the stored evidence hash. The client checks run ID, pinned revision, query hash, row bounds, and column presence before rendering a selected row. Selection supports rows beyond the 50-row preview, moves keyboard focus, and announces the selected row. Full captured JSON is available under disclosure.

API errors retain HTTP status. Recovery distinguishes expired sessions, permissions, missing/out-of-scope cases, conflicting state, invalid fields, and service failure. Notes and outcome text remain in component memory on failures. A reload button refreshes the saved case without resetting typed fields. Session expiry disables authenticated actions and offers the existing sign-in return path. Conflicts disable decision controls until reload. Text is not stored in browser storage; leaving the page can lose unsaved text.

New drafts record their verified creator when a bearer is supplied and explicitly identify synthetic-demo scope. Case brief/evidence/audit reads and transactional transitions use a central access check:

- Analysts can read cases they created.
- Action owners can read only their assigned cases.
- Reviewers can access the deployment's synthetic demo collection.
- Out-of-scope records return 404 to avoid disclosing existence.
- Legacy records with absent scope remain synthetic-demo records with no inferred creator. Reviewers retain access; analysts do not acquire ownership by inference.
- Unknown scope values fail closed.

This is a prototype policy, not customer tenancy. Public graph captures, witness exports, and anonymous synthetic drafting remain existing demo boundaries. No sensitive customer data should be imported. Metadata lives in the existing serialized brief; evidence hashes and audit history are unchanged. No schema migration is needed for this increment.

## Verification

- Web tests: 76 passed.
- Agent tests: 21 passed.
- Typecheck and production web build passed.
- Lint: zero errors; the existing unused `compact` warning remains.
- `git diff --check` passed.

Added citation tests for exact row selection beyond the preview, mismatched run/revision/query, invalid row indices, missing columns, and recovery messages. Added cross-principal case-access tests and HTTP checks that brief/evidence/audit endpoints reject out-of-scope users. Updated wrong-owner bridge expectations from 403 to non-disclosing 404.

Browser rehearsal used tab-only synthetic responses. A row-60 citation selected Platform 59 and focused the captured-row region. A 409 review response retained the typed note and offered reload. At 390px width, document width remained 390px. No real identity provider or live graph was exercised. The final conflict-control lock was added after that browser rehearsal and checked by typecheck/build rather than a second browser rehearsal.

No deployment, identity-provider configuration, external messages, paid inference, customer-data import, or retained-data migration was performed.

## Next work

Implement explicitly scoped eligible-owner selection and bounded saved-case queues after agreeing reviewer collection scope. Add indexed access metadata and migration/recovery tests if collection queries need them. Add committed browser tests for reload, expiry, mismatched evidence, and conflict locking. Validate the access policy with a buyer before extending it to private data.
