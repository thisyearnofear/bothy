# Execution log

## 4 October 2026: browser SSO session bridge

**Baseline:** `b56e188`. This slice closes the browser sign-in gap only. It does
not touch the road/flood track, the agent loop, or the graph sidecar.

### Implemented

- Web app is now a backend-for-frontend. `app/api/auth/{login,callback,logout}`
  performs authorization code + PKCE (S256) with state and nonce, exchanges the
  code server-side, and stores the access token in an encrypted HttpOnly/Secure/
  SameSite=Lax `bt_sess` cookie (A256GCM, key derived from
  `BOTHY_SESSION_SECRET`). Expired sessions refresh once, then fail to 401.
- `app/api/defense/[...path]` forwards `Authorization: Bearer …` to the agent.
  It allowlists the nine defence route shapes, allowlists request body fields,
  strips any browser-supplied `Authorization` header, checks `Origin` on writes,
  and preserves the agent's 401/403/409/503 verbatim rather than collapsing
  them to 502. The agent never receives a cookie.
- `/defense` resolves the session server-side so the first paint is correct, and
  surfaces explicit sign-in / "SSO not configured" states, the verified subject,
  and sign-out.
- `next.config.ts` now excludes `/api/defense` and `/api/auth` from the
  `/api/:path*` agent rewrite.

### Correction made during this slice

The first implementation assumed a filesystem route handler would outrank the
`/api/:path*` rewrite. That was wrong. Per Next's documented routing order a
bare-array rewrite is `afterFiles` (step 6), checked **before** dynamic routes
(step 7), so it shadowed `app/api/defense/[...path]` and forwarded review
traffic to the agent with no token — `/api/auth/*` only worked because it is a
static route served at step 5. Caught by a local HTTP check against the running
app, not by unit tests, and fixed with an explicit rewrite exclusion.

Also fixed: `A256GCM` requires exactly 32 bytes, so a longer
`BOTHY_SESSION_SECRET` threw at seal time. The key is now SHA-256-derived from
the configured secret, domain-separated per purpose.

### Validation

- `npm test`: **87 passing** (67 new web + 20 agent), 0 failing.
- `npm run typecheck`, production web build, `git diff --check`,
  `scripts/check-secrets.sh`: passed.
- `npm run lint`: zero errors; the same pre-existing unused `compact` warning
  in `CaseList.tsx`.
- New web suite: fail-closed SSO config matrix, PKCE S256, encrypted-cookie
  round-trip plus wrong-key and tamper rejection, route/body allowlist, CSRF
  origin checks, status passthrough, and a full brief → review → assign →
  acknowledge → outcome journey driven through the **real** agent
  `defenseRouter` (not a mock).
- Local HTTP check against a running build with a stub agent: cookie was
  converted to `Authorization: Bearer …`; the agent saw **no** cookie; a client
  `Authorization: Bearer ATTACKER` header was stripped; smuggled `subject` and
  `evidenceHash` were dropped from the forwarded body; cross-origin write
  returned 403; a non-allowlisted path returned 404; `/api/graph/health` still
  proxied to the agent; unconfigured `/api/auth/login` returned 503.

### Not done / not claimed

- Never exercised against a real identity provider. No buyer IdP, no live
  authorization code exchange. All identity testing used locally minted
  test-only keys.
- No live graph writes/simulation, paid inference, external message, deployment,
  or hackathon submission.
- Phase 2 walkthrough packaging, EDTH submission evidence, freezing the road
  demo, and the Phase 4 freshness worker are all still outstanding.

## 3 October 2026: focus and trust foundation

**Baseline:** `a1b97ca`. Pre-existing: winter/flood scoring and replay, Strands
and scripted brains, TuringDB catalogue/sidecar, simulation/diff, SQLite witness
and digest storage, pilot pages. Do not claim these as newly built here.

**This slice:** documentation and steering focused on defence programme-impact
briefs; independent defence workspace; graph API contract corrections;
server-captured witness evidence instead of browser-authored rows; approval-gated
email queue/sender; opt-in Nebius provider configuration; regression tests.

### Implemented

- Defence-focused landing and `/defense`, independent of the road catalogue.
  Primary gallium question, all eight catalogue questions, tabular results,
  visible source/coverage caveats, and advanced replay/simulation controls.
- Catalogue/bench response envelopes and pilot-count route corrected; scenario
  selection clears prior results/exports, and witness rerun links preserve the
  selected defence question.
- Captured graph runs persist in SQLite. Witness creation accepts only `runId`,
  rejects caller-authored evidence/approval fields, retains all captured rows,
  and exports provenance plus an explicit unapproved boundary. Legacy packs are
  labelled separately; HEAD captures disclose the absence of commit pinning.
- Pending-only road decisions; email queueing moved to approval; sender
  independently excludes pending/rejected rows. Log-only delivery does not
  expose recipient/body or mark mail sent. External dispatch requires a token.
- No unrelated loitering-munition lookup during a scripted road assessment.
- Faint-text contrast increased; misleading illustrative-replay language
  corrected. Pilot fallback admits when contact details were not retained.
- Server-only Nebius provider requires explicit key, endpoint, and model.
  Configuration is connected mode and has not been exercised against Nebius.

### Validation

- `npm test`: **11 passing** regression tests, using dummy provider config and
  mocked email transport; no real message or inference.
- `npm run typecheck`: passed across both apps.
- `npm run lint`: zero errors; one existing unused `compact` warning in
  `CaseList.tsx`.
- `npm -w @bothy/web run build`: passed, including `/defense`.
- `git diff --check` and witness QR Python syntax: passed.
- Isolated API with temporary SQLite and deliberately unavailable local
  Postgres: real catalogue query returned **34 gallium-dependent platforms**;
  witness hash/rows matched; forged fields rejected (400), unknown run/scenario
  rejected (404). Road catalogue returned 503 without crashing defence.
- Captured runs and witness links survived an API restart; hash chain continued.
- Actual Next same-origin proxy: `/`, `/defense`, `/watch`, witness page, catalogue,
  scenario run, export, and explicit-commit replay passed. No branch mutation
  or external email/inference was performed.
- Browser: analyze → export → witness → reopen selected question passed using
  the isolated API. At 390px, no horizontal document overflow; result starts
  around 504px, evidence around 1,095px after capping the row viewport.
  Faint-on-panel contrast measured **4.83:1**. Screenshot capture was unavailable
  during the earlier review; these are DOM/interaction checks, not visual certification.

### Outstanding at phase 0 (updated by the next slice below)

Authentication/roles, atomic decision + audit + outbox, sidecar request
isolation/read-only enforcement, automatic commit pinning and model-version
binding, private sharing, a complete defence brief/action/outcome journey,
real-data pilot validation, background monitoring, and live eligible NVIDIA
inference on Nebius. Explicit-commit replay is verified; it does not make every
HEAD export reproducible.

No submission, deployment, paid inference, buyer outreach, or external email is
part of this local implementation slice.

## 3 October 2026: isolated evidence and verified review

**Baseline:** `b9ebc61`, committed locally at the user's request, not pushed.
The next slice preserves the existing stack and uses a standard OIDC bearer
adapter selected by the user, rather than adding local passwords.

### Implemented

- Exact reviewed read catalogue enforced in both agent and Python bridge,
  including rejection before contacting a legacy sidecar. No public change
  lifecycle or submit route. A fresh client owns each graph/commit/change and
  closes its HTTP transport; database transport is loopback-only.
- HEAD resolved to a concrete revision before execution. Captures retain the
  actual revision and query SHA-256; witness v2 includes both. Old unpinned
  captures remain readable as witnesses but cannot become new briefs.
- `jose` OIDC API access-token verification: RS256/ES256, issuer, dedicated
  audience, subject and expiry/age. Roles come from the server subject allowlist.
  No config means no approval/simulation. Road review also requires OIDC and
  ignores actor-name authority.
- Deterministic, five-row cited verification brief with complete evidence hash,
  graph/query revisions, generator version, source gaps and no cloud inference.
- Defence review + audit and action + audit commit or roll back together.
  Pending-only review, approval-before-assignment, configured owner, owner-only
  acknowledgment, then owner-recorded outcome. No defence email dispatch.
- UI shows drafts, provenance, role gates, assignment/acknowledgment/outcome
  controls. Late draft responses cannot overwrite a newly selected scenario.
  Saved briefs require verified SSO to reopen; no pasted-token/login shortcut.
- Legacy graph tool descriptions now disclose catalogue-only reads and actual
  revisions. Regression assertions caught and repaired malformed property-map
  templates in the BOM/material/chokepoint helpers; unreviewed targets fail closed.

### Validation

- `npm test`: **20 passing** TypeScript regression tests.
- `npm -w @bothy/agent run test:graph`: **6 passing** Python sidecar tests.
- `npm run typecheck`, production web build, and `git diff --check`: passed.
- `npm run lint`: zero errors; the same pre-existing unused `compact` warning.
- Real hardened bridge: concurrent pinned reads across all three graphs;
  arbitrary write/CALL/multi-statement queries rejected; submit endpoint absent.
- Actual Next proxy: 34-row gallium capture, query hash, deterministic brief,
  witness v2, explicit replay and identical-revision diff passed. Unconfigured
  defence/road approval and simulation returned 503, not a demo bypass.
- Signed **test-only** JWT HTTP journey exercised role failures, forged actor/
  evidence fields, duplicate approval, assignment, wrong owner, acknowledgment
  and outcome. Audit-trigger failure rolled the decision back. These are not
  live identity-provider integration tests.
- SQLite close/reopen test retains the reviewed brief, completed action,
  complete evidence and four audit transitions.
- Browser with real graph/API: analyze → five cited draft rows; pinned provenance
  visible; approval/rejection disabled without SSO. At 390px, document width is
  390px. Scenario switching clears old results/briefs; deliberately delayed draft
  responses do not restore stale state or links.
- No live graph writes/simulation, paid inference, external message, deployment,
  submission or remote Git push. Existing user services were not restarted.

### Remaining gates

Real OIDC issuer/subjects exercised against a live identity provider (the session
bridge itself is implemented and tested, but unvalidated against a real IdP);
tenant/private-data sharing and legacy digest-wall privacy; transactional
Postgres road outbox; abandoned-change reclamation and coordination with
administrative graph writers; Nebius eligible model verification plus
budget-approved live inference and model-version binding; bounded Strands
handoff; monitoring/freshness; independently validated buyer data and
operational outcomes. This is a verification workflow, not a certified defence
operations system.
