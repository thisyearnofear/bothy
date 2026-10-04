# Proof: the agent cannot approve its own conclusion

Date: 2026-10-04
POC: Bothy team lead
TL;DR: Three independent layers of evidence — a live probe script, the test suite,
and the agent's own tool surface — show that no approval-capable path accepts a
decision from the agent or from an unverified caller. Reproduce with
`bash scripts/refusal-demo.sh`.

This exists because "the agent drafts, a human approves" is the product claim, and
a claim about who holds authority has to be demonstrated, not asserted.

## Layer 1 — the agent has no approval verb (structural)

The agent's tool surface is the whole of its capability. Enumerated from
`apps/agent/src/agent/tools.ts`:

| Kind | Tools |
|---|---|
| Retrieval | `get_weather_warning`, `get_road_disruptions`, `search_incidents`, `get_route_characteristics`, `get_traffic_speed`, `get_live_weather_snapshot`, `get_blast_radius`, `replay_at` |
| Output | `draft_public_warning`, `create_human_review` |

There is no `approve`, `decide`, `assign`, `acknowledge`, `record_outcome`, or
`merge`. The only exit from a decision is `create_human_review`, and that handler
(`tools.ts:222-261`) hard-codes the outcome of its own work:

```ts
status: "pending",
decisionNote: null,
decidedAt: null,
...
await ctx.audit(ctx.scenario, "bothy-agent", "create_human_review", ...);
```

`status` is not a parameter. Neither is the audit actor. The agent cannot mark
something approved, and cannot misattribute an action to a human, because those
values are not supplied by the caller.

**This is the load-bearing layer.** It holds regardless of how the service is
configured.

## Layer 2 — fail-closed by default (live, captured 4 October)

`scripts/refusal-demo.sh` against the running agent on `:8787`. Every probe
targets a nonexistent case id and authentication runs before any store access, so
the script writes nothing.

```
1. The agent's own decision path, with no session at all
  POST review {decision:approved}                    503  {"error":"OIDC review is not configured; approval is disabled"}
  POST action assign                                 503  ...
  POST action acknowledge                            503  ...
  POST action outcome                                503  ...
  POST reassessment                                  503  ...

2. Forged or unusable credentials
  POST review with a garbage bearer token            503  ...
  POST review with a hand-written JWT                503  ...

3. Identity and evidence cannot be asserted from the request body
  POST review carrying a claimed reviewer subject    503  ...
  POST review carrying substituted evidence rows     503  ...

4. Read and side-effect surfaces
  GET audit log / audit chain check / eligible owners 503 ...
  POST graph simulate                                503  ...

Result: every approval-capable surface refused. Nothing was written.
```

The script prints its own state. In this configuration it says so explicitly:

> State: UNCONFIGURED. The 503s show approval is disabled until a verified
> reviewer identity is configured (`apps/agent/src/auth.ts:45`). This proves the
> default is fail-closed. It does NOT by itself prove role separation, because
> nothing got far enough to be checked for a reviewer role.

That caveat matters. A juror who says "it is only refusing because you switched it
off" is right — and that is the correct behaviour, not the interesting one. The
interesting claim is what happens when it *is* switched on, which is Layer 3.

## Layer 3 — role separation, asserted deterministically (tests)

`npm -w @bothy/agent test` — 32 passed, 0 failed on 4 October. The named
assertions that carry this claim:

| Test | What it proves |
|---|---|
| `OIDC fails closed when configuration is absent, partial, or malformed` | no partial configuration silently enables decisions |
| `OIDC verifies signatures, issuer, audience, expiry, and configured subjects; token roles are ignored` | **roles come from the server-side principals map, never from the token.** A caller cannot self-grant `reviewer` by putting it in a claim |
| `HTTP identity configuration requires explicit development-only loopback opt-in` | the HTTP-issuer allowance needs both `NODE_ENV=development` and `BOTHY_OIDC_ALLOW_LOCAL_DEMO=true` |
| `OIDC-protected HTTP journey rejects forged fields, wrong roles, duplicate reviews, and wrong action owners` | an `analyst` token calling `/review` returns 403; forged body fields return 400 |
| `witness requests cannot substitute rows, officer, scenario, or approval` | evidence export can't be edited in flight |
| `review update is conditional and never overwrites a prior decision` | a second decision cannot clobber the first |
| `a rewritten audit entry breaks the chain at that entry` | tampering is detectable |
| `unconfigured adapter never enables decisions` | the default adapter is inert |
| `finding acceptance refuses changed evidence and retains the completed owner action` | approval cannot be re-derived from mutated evidence |

To capture Layer 3 live rather than as a test record, run the same script against
the disposable-SSO agent. Both launchers want port 3001, so stop the venue stack
first; see `docs/demo-sso-rehearsal.md` for the full walkthrough.

```sh
node scripts/demo-sso.mjs                                  # provider :9099, agent :8798
AGENT_URL=http://localhost:8798 bash scripts/refusal-demo.sh   # expect 403 and 400, not 503
```

## What this does not prove

- Not a security certification. No external penetration test, no review of key
  custody, no buyer identity-provider validation.
- Hash-linked witness entries are **not authenticated signatures**. The chain
  detects rewriting; it does not establish who wrote an entry. Per-role signing
  (ed25519 on append, verify on read) is the next step and would narrow this gap —
  it would not close the question of whether the underlying evidence is true.
- Synthetic role accounts (`analyst`, `reviewer`, `owner`) demonstrate protocol and
  authorization integration only.
- Operational closure of a case is still unimplemented; a recorded owner outcome is
  not reviewer acceptance and not case closure.

## Related reliability finding (same session, 4 October)

While probing, the agent process was found dead. The log (`/tmp/agent-venue.log`)
shows the cause, and it was not the probes:

```
GET /api/subscriptions → listSubscriptions (apps/agent/src/repo.ts:245)
AggregateError [ECONNREFUSED] ::1:5433 / 127.0.0.1:5433
    at async <anonymous> (apps/agent/src/server.ts:614)
```

`server.ts:614` is an `async` Express 4 handler with no `try`/`catch`. When the
Postgres tunnel is down, the rejected promise becomes an unhandled rejection and
Node terminates the process. **An unauthenticated `GET /api/subscriptions` is
enough to take the agent down** whenever `DATABASE_URL` is unreachable — which is
the normal state for the defence demo, since README states the defence route does
not require the Postgres road catalogue.

Practical consequence on a venue floor: anyone opening `/watch` (the older
road/flood demo) without the tunnel can kill the service that `/defense` depends
on. Stack restarted and healthy after this; the defect is unfixed.

Suggested fix, small and local: wrap the handler and return the degraded shape the
digest and pilot routes already use (`{ subscriptions: [], count: 0,
degraded: true }`) rather than throwing, so a missing optional dependency degrades
instead of crashing. This is a prerequisite for any credible
"runs in your environment" claim — see `docs/deployment-design.md`.
