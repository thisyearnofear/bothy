# European defence submission pack

Date: 2026-10-03
POC: Team lead to confirm event, team number, submission channel, and event build window.
Status: Draft materials prepared; not submitted or published as an event entry.
TL;DR: Lead with a defence-prime analyst investigating primary-gallium exposure. Demonstrate captured graph evidence, cited verification, and human ownership. Confirm the active event and rehearse the live graph before claiming submission readiness.

## Event confirmation: blocking

Sources checked on 3 October 2026:

- [London hackathon listing](https://events.eurodefense.tech/european-defense-tech-hackathon-london): agenda shows June 26 through June 28, marked done. The retrieved page does not specify a year. It requests a team-number-prefixed PDF by Sunday noon, a linked recorded demo, and a three-minute pitch with two minutes Q&A. It does not establish an upcoming October deadline or submission channel.
- [London 2026 Defence Tech Days](https://eurodefense.tech/london-2026/): October 1 through 8, 2026, for the broader event series. Its hackathon link points to [this address](https://events.eurodefense.tech/events/european-defense-tech-hackathon-london-2), which returned a page-not-found message during this check.
- The repo's October 30 deadline belongs to the separate Nebius track and must not be reused for EDTH.

Follow-up source check: the current [October hackathon page](https://events.eurodefense.tech/european-defense-tech-hackathon-london-2) resolves, identifies October 1 through 4, and explicitly permits bringing a project. The user supplied Friday 18:00 through Sunday 4 October noon as the 42-hour build window. The `/resources` page remains HTTP 401, so sponsor-specific eligibility, contribution accounting, deck/video format, team number, deadline time zone, and submission channel still need the authenticated instructions. The earlier page-not-found observation above concerned a different `/events/` address.

No organizer has been contacted by this session. Treat the older deck format below as a preparation template until the current resources confirm it. See [asset manifest](edth-asset-manifest.md) for verified dataset/software sources and provenance boundaries.

## Submission proposition

Working title: Bothy: accountable defence supply-chain exposure.

One-sentence description: Bothy helps a defence-prime supply-chain analyst turn a disruption question into captured dependency evidence, a cited verification brief, and an owned follow-up without confusing exposure with confirmed production loss.

Primary buyer hypothesis: a European defence prime's programme or supply-chain resilience lead. Primary user: its supply-chain analyst. Military logistics cells are later design partners/channel, not a second initial buyer.

Demo question: which platform names in the captured public/synthetic graph have dependencies on Primary gallium? The catalogue query returns names through one-or-more CONTAINS relationships; it does not return programme identities, inventory, substitutes, delivery timing, or intervening path details. It is limited to 50 rows. Do not call its result the full programme blast radius.

## Suggested six-slide deck

1. Problem and user: when a material or supplier is disrupted, an analyst needs to establish what is exposed, why, and who verifies the consequences. Show the specific recurring question rather than a general alert-dashboard pitch.
2. Demonstration: gallium capture, observed names, uncertainty, and one inspectable cited row. Use screenshots from the actual rehearsed submission revision; do not present synthetic browser fixtures as live graph evidence.
3. Technical approach: reviewed catalogue query, isolated TuringDB reads, pinned graph revision/query hash, captured result, deterministic cited brief, verified reviewer, assigned owner, transactional audit. Show replay/comparison only if rehearsed. Explain that branch simulation is an abandon-only marker demonstration.
4. Deployment and trust: software prototype using Next.js, TypeScript agent, local SQLite records, and Python/TuringDB sidecar. Identity requires configured OIDC/SSO; no real buyer IdP is certified. Graph analysis may run locally, but full offline operation, local model inference, private customer tenancy, and export-control suitability are unverified. Do not claim zero deployment cost.
5. What was built: a dated contribution table tied to commits and the confirmed event build window. Separate earlier road/flood work, graph integration, and subsequent defence workflow improvements. Do not label all current functionality as weekend-built.
6. Next proof and ask: one approved reference dataset, analyst-checked dependency accuracy/coverage, and measured time to a review-ready brief. Ask for a design partner and identity/data-handling review. Pilot pricing is indicative, not validated traction. Include repository and permitted demo-video links only when verified.

If the confirmed format requires `NN_ProjectName.pdf`, replace NN with the assigned team number. Do not submit placeholders or an inaccessible video link.

## Three-minute pitch draft

A material disruption creates an immediate question for a defence supply-chain analyst: which platforms or programmes might be exposed, what evidence supports that conclusion, and who will check the consequences?

Bothy turns that investigation into an accountable case. Our initial example is primary gallium. The prototype queries a versioned supply-chain graph and captures the returned platform names alongside the exact graph revision, query, and retrieval time.

Here is the exposure summary. These are names observed in the captured evidence, not a forecast of stopped production. The query is limited, and inventory, alternatives, and delivery timing remain unknown. That boundary matters because a dependency alone cannot establish programme failure.

From the capture, Bothy prepares a deterministic verification brief. A reviewer can inspect a claim's exact stored row instead of trusting an unsupported narrative. Authorized review, action assignment, owner acknowledgment, and recorded findings stay with the case and its audit history.

Versioning also supports revisiting the analysis. A linked revision uses a separate capture and starts pending review; it does not overwrite the original evidence or inherit its approval. Native replay and comparison are available as advanced tools, with their meaning and limits stated explicitly.

The architecture combines a Next.js interface, TypeScript service, Python/TuringDB graph access, and SQLite case records. Reads are limited to reviewed queries, and decision authority comes from verified server-side roles. The full flow is tested with synthetic identities and data. We have not yet validated a real buyer identity provider, private customer deployment, or operational effectiveness.

For the event contribution, we will identify the exact work completed inside the organizer-confirmed build window and distinguish it from the existing project. Our next proof is a scoped pilot with one defence-prime team: compare dependencies against an agreed reference set and measure time to a review-ready brief against their current process.

We are looking for a design partner who can help validate that recurring decision, the evidence gaps, and the data-handling constraints. The product promise is a defensible investigation with a responsible next step.

Rehearse aloud and trim to the confirmed pitch duration; no measured speaking time is claimed. Replace the event-contribution sentence with verified specifics before presenting.

## Demo rehearsal: evidence before spectacle

Use synthetic/public data only and an isolated data directory where possible. Never seed/reset a retained ledger for rehearsal. Do not configure paid inference or external dispatch.

Core demonstration:
1. Open `/defense?scenario=gallium-exposure` with a healthy graph service.
2. Analyze the reviewed question; verify pinned revision, capture timestamp, returned names, limit and source caveats.
3. Draft through the configured browser session bridge. Inspect a stored-row citation.
4. If a permitted demo identity environment is available, review, assign a configured owner, acknowledge as that owner, and record a synthetic observation. If not available, stop at the boundary and show test evidence as tests, not a live authenticated journey.
5. Reopen the saved case with graph unavailable: retained evidence should remain inspectable through the case service.
6. Show review/assignment/owner work views under their actual verified roles.
7. Optionally recapture into a linked revision; verify the parent is unchanged and child is pending.

Graph-track supplements:
- Load actual graph history. Replay a concrete revision and compare stored versions only when the pack has useful history; do not invent a change if versions are identical.
- If authorized and rehearsed, show temporary marker simulation abandoned without submit. State that it does not model lost production or a mitigation outcome.
- Export only public/synthetic evidence. A witness hash is neither a signature nor private sharing.

Failure rehearsal:
- Start with graph unavailable: questions/service error must settle, retry must work, and no results are fabricated.
- Show an expired or wrong-role session without treating it as an operational approval.
- Show conflict recovery preserving a note and requiring reload.
- Confirm a saved-case link cannot bypass access checks.

Record a short actual demo only after those checks. A suggested 60-to-90-second edit covers the exposure question, capture, caveat, cited row, authorized next step or explicit auth boundary, and retained case. Publish/upload only with explicit authorization and confirmed event requirements.

## Evidence and contribution ledger

Implementation baseline pushed: `2f42123` on `main` (3 October 2026).

| Evidence | Status |
|---|---|
| TypeScript tests | Latest local verification: 81 web and 25 agent passed; earlier pushed baseline was 79/24. |
| Python graph boundary tests | 6 passed on 3 October; mocked boundary tests, not live query proof |
| Typecheck and production build | Passed after local OIDC rehearsal changes; final commit checks rerun before publication. |
| Commit checks | ESLint staged checks and secret scan passed |
| Local authenticated browser rehearsal | Real disposable OIDC provider, confidential code exchange/PKCE, signed API-token verification, live graph capture, reviewer approval/assignment, separate owner login, acknowledgment/outcome and persisted audit verified. Fixed synthetic accounts; not buyer-IdP validation. See `demo-sso-rehearsal.md`. |
| Live graph on current worktree | Gallium-chain query rehearsed through the real sidecar/agent/UI at graph revision `fa702a0364247caf`; ten sampled rows returned. Rehearse again on the final submission commit. |
| Real buyer IdP | Not validated |
| Clean-clone graph pack setup | Not rehearsed |
| Submission visuals | Live desktop/mobile PNGs in `assets/`; six-slide print-ready `docs/edth-deck.html` draft rendered and image checked. No final PDF, recorded video, public upload or submission. |
| Event eligibility/deadline/channel | Unconfirmed |

Useful dated commits, all showing 3 October 2026 in local git history:
- `2f42123`: scoped work views, linked revisions, saved cases, domain organization.
- `fd824f5`: exposure summary, citation navigation, recovery, synthetic case access.
- `380aee9`: browser SSO bridge.
- `0c5883f`: authenticated review and verified graph reads.
- `b9ebc61`: focused defence workspace and evidence safeguards.
- `a1b97ca`: venue launcher and witness-related setup.

Commit dates alone do not prove event-period eligibility. Confirm the build window and compare a documented start revision against the submission revision. Preserve historical venue measurements as historical observations, not fresh performance evidence.

## Jury questions and grounded answers

- Does gallium exposure mean production stops? No. It establishes graph dependency in captured evidence; inventory, substitutes, timing, and programme mapping require verification.
- Why use a graph? Multi-hop dependencies and versioned queries make a useful investigation inspectable. Latency alone is not the pilot success criterion.
- Is the model making decisions? The current brief is deterministic. Verified humans review and own verification; cloud inference is not required by this page.
- Is this private or deployment-ready? It is a synthetic/public prototype. Customer tenancy, approved data handling, real IdP validation, and operational readiness remain gates.
- Does the branch demo predict mitigation? No. It demonstrates temporary graph-state mechanics without submitting changes.
- What was built at the event? Answer from the confirmed event window and recorded diff, not from the whole current repository.

## Go/no-go checklist

Do not claim readiness until event details, team number, and build-window attribution are confirmed; the exact submission revision passes checks; the live core demo and failure path are rehearsed; and all shared assets are accessible, non-sensitive, and allowed by current rules.

Operational certification is not required to honestly demonstrate a prototype, but its boundaries must remain visible. No deadline, team number, judge rubric, market size, traction, prediction accuracy, or outcome claim should be invented to complete the deck.
