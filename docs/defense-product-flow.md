# Defence product flow

Date: 2026-10-03
POC: Bothy product lead
TL;DR: The front door now organizes work by role. Investigation and retained case records are separate, and pilot onboarding explains the agreements needed before private data transfer. This is a coherent prototype adoption flow, not production certification.

## Entry and navigation

`/defense` opens a workspace. Anonymous users can explore the synthetic gallium sample, sign in when configured, or scope a pilot. Signed-in reviewers default to awaiting review; action owners default to their active work; analysts default to accessible investigations. For combined reviewer/owner roles, review takes precedence and the work selector remains available.

`/defense?mode=investigate&scenario=gallium-chain` opens a separate investigation. Existing `?scenario=...` links remain supported. `/defense?brief=...` opens the retained case and takes precedence over investigation parameters. The home CTA now points to the workspace.

The sample workspace is not a preloaded customer environment. Graph analysis needs the local service; browser case drafting and saved work require configured SSO. No live monitoring or sensitive-data upload is introduced.

## Case journey

A saved case leads with its verified brief stage, case identity, verification owner, due time, and available actions. Captured findings and provenance are expandable. Retained exposure context and linked revision creation follow, with the dependency explanation available separately.

The existing lifecycle remains: captured analysis, pending brief, approved/rejected verification, assignment, acknowledgment, owner-recorded outcome. No new authority or state transition was added in this presentation pass. Reviewer acceptance of an owner finding, reassessment, and operational case closure remain unimplemented and are explicitly disclosed. A completed owner action must not be presented as a closed operational incident.

New investigations and linked revisions do not replace evidence supporting an earlier decision. Case access remains enforced by the existing server policy; role-specific default views do not grant additional permissions.

## Pilot onboarding

The pilot surface describes four agreements: decision and responsible roles; evidence/access/hosting boundary; process rehearsal and reference-set validation; jointly agreed acceptance. It collects contact interest only and expressly refuses sensitive BOMs, programme details, credentials, and file transfer through this page. Customer tenancy, secure transfer, deployment and data handling require separate design and approval.

Indicative pricing remains a proposal, not proof of demand. The pilot is not represented as contracted, buyer-validated, or immediately operational.

## Verification

88 web tests and 25 agent tests passed. Tests cover role defaults, combined-role precedence, route mode parsing, sample/private boundaries, and owner-first work. Web typecheck, production build, and diff checks passed; lint retains the existing CaseList warning. An initial combined check timed out; suites and checks were rerun separately.

Production-preview browser checks verified sample-to-investigation navigation, four onboarding steps without a file input, reviewer default awaiting-review view using isolated response fixtures, and 390px layout without page overflow. A final service-error copy refinement was type/test checked after the initial preview build. These checks do not establish customer usability or constitute a new live identity/graph rehearsal.

## Next validation

Rehearse the exact analyst/reviewer/owner journey with the local SSO setup after committing. Agree finding acceptance and closure semantics before implementing them. Validate the pilot boundary, roles, and reference dataset with a design partner before private ingestion or operational deployment.
