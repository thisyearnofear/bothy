# Defence product flow

Date: 2026-10-03
POC: Bothy product lead
TL;DR: The front door now organizes work by role. Investigation and retained case records are separate, and pilot onboarding explains the agreements needed before private data transfer. This is a coherent prototype adoption flow, not production certification.

## Guided sample onboarding

`/defense?mode=onboarding` introduces a synthetic gallium-delay hypothesis and a four-step analyst/reviewer/owner/reviewer exercise. Each step names its task and expected check; six stress checks help a team test the assumptions. The guide does not track case completion. It opens the actual sample in a separate tab and routes private adoption to the pilot agreements. See [sample onboarding](defence-prime-sample-onboarding.md).

## Entry and navigation

`/defense` opens a workspace. Anonymous users can explore the synthetic gallium sample, sign in when configured, or scope a pilot. Signed-in reviewers default to awaiting review; action owners default to their active work; analysts default to accessible investigations. For combined reviewer/owner roles, review takes precedence and the work selector remains available.

`/defense?mode=investigate&scenario=gallium-chain` opens a separate investigation. Existing `?scenario=...` links remain supported. `/defense?brief=...` opens the retained case and takes precedence over investigation parameters. The home CTA now points to the workspace.

The sample workspace is not a preloaded customer environment. Graph analysis needs the local service; browser case drafting and saved work require configured SSO. No live monitoring or sensitive-data upload is introduced.

## Case journey

A saved case leads with its verified brief stage, case identity, verification owner, due time, and available actions. Captured findings and provenance are expandable. Retained exposure context and linked revision creation follow, with the dependency explanation available separately.

The lifecycle now includes reviewer reassessment after an owner-recorded outcome. Completed findings return to the reviewer queue until a verified reviewer records a nonempty rationale and accepts the verification or requires further work. Reassessment is pending-only, evidence-checked, and audited transactionally. The original owner action and finding remain unchanged.

Further verification records the need for follow-up; it does not automatically create or assign a new task. The reviewer can use the existing linked-revision flow, with independent review/assignment. Neither acceptance nor further verification closes an operational incident or proves risk eliminated.

New investigations and linked revisions do not replace evidence supporting an earlier decision. Case access remains enforced by the existing server policy; role-specific default views do not grant additional permissions.

## Pilot onboarding

The pilot surface describes four agreements: decision and responsible roles; evidence/access/hosting boundary; process rehearsal and reference-set validation; jointly agreed acceptance. It collects contact interest only and expressly refuses sensitive BOMs, programme details, credentials, and file transfer through this page. Customer tenancy, secure transfer, deployment and data handling require separate design and approval.

Indicative pricing remains a proposal, not proof of demand. The pilot is not represented as contracted, buyer-validated, or immediately operational.

## Verification

88 web tests and 25 agent tests passed. Tests cover role defaults, combined-role precedence, route mode parsing, sample/private boundaries, and owner-first work. Web typecheck, production build, and diff checks passed; lint retains the existing CaseList warning. An initial combined check timed out; suites and checks were rerun separately.

Production-preview browser checks verified sample-to-investigation navigation, four onboarding steps without a file input, reviewer default awaiting-review view using isolated response fixtures, and 390px layout without page overflow. A final service-error copy refinement was type/test checked after the initial preview build. These checks do not establish customer usability or constitute a new live identity/graph rehearsal.

### Finding reassessment follow-up

The reassessment increment passed 89 web and 27 agent tests, typecheck and production build. Tests verify immutable owner outcomes, evidence checks, duplicate/role denial, audit rollback, and reviewer queue behavior. Isolated browser fixtures verified acceptance with rationale and a retained owner finding, with no horizontal overflow at 390px. No new live identity-provider rehearsal was performed for this transition.

## Next validation

Rehearse the exact analyst/reviewer/owner journey with the local SSO setup after committing. Rehearse finding acceptance and follow-up with the local identity provider; agree operational closure semantics separately before implementing closure. Validate the pilot boundary, roles, and reference dataset with a design partner before private ingestion or operational deployment.
