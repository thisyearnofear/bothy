# Local SSO and owned-action rehearsal

Date: 2026-10-03
POC: Bothy team lead
TL;DR: A real local OIDC authorization-code flow with PKCE and confidential-client exchange was browser-rehearsed through live graph capture, reviewer approval/assignment, owner sign-in, acknowledgment, and outcome. This proves local protocol integration, not buyer identity-provider compatibility.

## Reproducible setup

Requires Node 24 (or a compatible Node version), npm development dependencies, Python TuringDB SDK, and the existing synthetic graph pack. No Docker or Java is needed. The rehearsal uses `oidc-provider` 9.12.2 as a development dependency, not Keycloak. Its default in-memory adapter and fixed account-selection UI are deliberately unsuitable for real authentication.

Use free loopback ports 9099 (provider), 8798 (agent), 3001 (web), 6688 (graph), and 6777 (sidecar). Stop existing development instances first; do not use broad process-kill commands or reset databases.

```sh
npm install --include=dev
# Local read-only graph daemon; do not use graph writes or reset flags.
turingdb start -turing-dir "$PWD" -p 6688 -i 127.0.0.1 -in-memory -load supply_chain_deep -demon
# Separate terminal:
TURING_HOST=http://127.0.0.1:6688 PORT=6777 python3 apps/agent/src/graph/sidecar.py
# Separate terminal:
node scripts/demo-sso.mjs
```

The launcher generates its signing key, confidential-client secret, and session secret in memory, starts agent/web with explicit loopback origins, and creates a disposable SQLite data directory under the OS temp directory. It never writes credentials to `.env` or Git. It refuses to run when the invoking environment says production. Stopping the launcher terminates its own child process groups; stop the sidecar and graph instance separately by their specific process IDs. Temporary ledger files remain local for inspection and can be removed by their owner after rehearsal.

The agent permits HTTP issuer/JWKS only with both `NODE_ENV=development` and `BOTHY_OIDC_ALLOW_LOCAL_DEMO=true`, and only on explicit loopback hostnames. Production remains HTTPS-only. Signature, issuer, API audience, token age, subject mapping, case access, and state-transition checks remain enforced. The web configuration supports optional `BOTHY_SSO_RESOURCE` for standard OAuth resource indicators while retaining its separate API-audience setting.

## Browser walkthrough

1. Open `http://127.0.0.1:3001/defense?scenario=gallium-chain`.
2. Select Sign in to review. The local provider displays fixed synthetic analyst/reviewer/owner accounts; this is not password authentication or an identity directory.
3. Choose reviewer and authorize the demo session. Verify the app reports subject reviewer and role reviewer.
4. Analyze the actual graph and draft the cited brief through the authenticated bridge.
5. Enter a clearly synthetic review note, approve, select eligible owner `owner`, set a due time, and assign. Approval authorizes verification only.
6. Save the brief URL. Sign out of the application, then end the provider session at `http://127.0.0.1:9099/session/end` and confirm. Application logout alone does not end provider SSO.
7. Reopen the saved URL, sign in as owner, authorize, and verify subject owner with action-owner role.
8. Acknowledge, enter a synthetic verification observation, and record outcome. Reopen/refresh to check completed status and audit.

The provider session and application encrypted HttpOnly session are separate. Never publish cookies, authorization codes, tokens, private JWKs, or temporary realm state. The fixed-account identity selector must never be exposed beyond this loopback demonstration, except in the invite-gated hosted variant described under "Sign-in for testers" in `docs/ops.md` (synthetic data only, passphrase-protected at the reverse proxy).

## Observed results

Actual case in disposable ledger: `65593e22-6b2e-46f9-b7e3-45f4bc83c98a`.
Live graph revision: `fa702a0364247caf`; ten sampled synthetic chain rows.

- Reviewer authorization, consent, code exchange, remote JWKS verification, and API audience acceptance succeeded.
- Browser draft creation persisted pending brief; reviewer approval persisted approved status.
- Configured owner assignment persisted assigned status; reviewer acknowledgment control was disabled.
- Application/provider logout and separate owner authorization returned to the same saved case.
- Verified owner acknowledgment and outcome persisted completed action status.
- Audit returned, in order: reviewer approved, reviewer action_assigned, owner action_acknowledged, owner action_completed.
- No browser fetch mocking, direct token insertion, authentication cookie injection, or role bypass was used.

The browser automation wrapper's datetime fill initially changed the DOM without updating the React form state. Dispatching standard input/change events enabled assignment. The persisted due time was independently read back; do not claim that the wrapper's first fill alone succeeded. Captures are in `assets/edth-sso-assignment.png` and `assets/edth-sso-outcome.png`.

Two setup defects were found and fixed: the launcher needed an explicit public web origin for callback redirects, and the sign-in return link needed a stable server/client first render. The launcher now supplies the origin; the link updates its return context after hydration.

## Limits

Synthetic role accounts demonstrate protocol/authorization integration only. No real buyer IdP, production security certification, customer tenancy, operational finding, external advisory, public deployment, or paid inference is established. No credentials or buyer configuration were changed. Full PDF/video submission artifacts remain separate work.
