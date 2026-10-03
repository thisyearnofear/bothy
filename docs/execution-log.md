# Execution log

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

### Still outstanding

Authentication/roles, atomic decision + audit + outbox, sidecar request
isolation/read-only enforcement, automatic commit pinning and model-version
binding, private sharing, a complete defence brief/action/outcome journey,
real-data pilot validation, background monitoring, and live eligible NVIDIA
inference on Nebius. Explicit-commit replay is verified; it does not make every
HEAD export reproducible.

No submission, deployment, paid inference, buyer outreach, or external email is
part of this local implementation slice.
