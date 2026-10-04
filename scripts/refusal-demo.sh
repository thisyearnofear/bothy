#!/usr/bin/env bash
# Demonstrate that no approval-capable surface accepts an unverified decision.
# Read-only: every request targets a nonexistent case id and authentication runs
# before any store access, so nothing is created or mutated.
set -uo pipefail

AGENT="${AGENT_URL:-http://localhost:8787}"
CASE="bothy-refusal-probe-00000000"
fail=0
unconfigured=0

probe() { # label method path body auth
  local label="$1" method="$2" path="$3" body="${4:-}" auth="${5:-}"
  local args=(-s --max-time 10 -o /tmp/bothy-refusal-body -w '%{http_code}' -X "$method" "$AGENT$path")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  local code
  code="$(curl "${args[@]}" 2>/dev/null || echo 000)"
  local detail
  detail="$(tr -d '\n' < /tmp/bothy-refusal-body 2>/dev/null | head -c 120)"
  printf '  %-50s %s  %s\n' "$label" "$code" "$detail"
  case "$code" in
    401|403|400|503) ;;
    *) echo "  !! expected a refusal, got $code"; fail=1 ;;
  esac
  [ "$code" = "503" ] && unconfigured=1
}

echo "Bothy approval-refusal probe"
echo "agent: $AGENT"
echo "case id: $CASE (does not exist; auth runs before any store access)"
echo

echo "1. The agent's own decision path, with no session at all"
probe "POST review {decision:approved}" POST "/api/defense/briefs/$CASE/review" '{"decision":"approved","note":"agent self-approval attempt"}'
probe "POST action assign"             POST "/api/defense/briefs/$CASE/action" '{"owner":"owner"}'
probe "POST action acknowledge"        POST "/api/defense/briefs/$CASE/action/acknowledge" '{}'
probe "POST action outcome"            POST "/api/defense/briefs/$CASE/action/outcome" '{"outcome":"done"}'
probe "POST reassessment"              POST "/api/defense/briefs/$CASE/reassessment" '{"finding":"accepted","rationale":"self"}'
echo

echo "2. Forged or unusable credentials"
probe "POST review with a garbage bearer token" POST "/api/defense/briefs/$CASE/review" '{"decision":"approved"}' 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJyZXZpZXdlciJ9.sig'
probe "POST review with a hand-written JWT"     POST "/api/defense/briefs/$CASE/review" '{"decision":"approved"}' 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJyZXZpZXdlciIsInJvbGVzIjpbInJldmlld2VyIl0sImV4cCI6OTk5OTk5OTk5OX0.'
echo

echo "3. Identity and evidence cannot be asserted from the request body"
probe "POST review carrying a claimed reviewer subject" POST "/api/defense/briefs/$CASE/review" '{"decision":"approved","reviewer":"reviewer","subject":"reviewer"}'
probe "POST review carrying substituted evidence rows"  POST "/api/defense/briefs/$CASE/review" '{"decision":"approved","evidence":[{"row":"fabricated"}]}'
echo

echo "4. Read and side-effect surfaces"
probe "GET audit log"        GET    "/api/defense/briefs/$CASE/audit"
probe "GET audit chain check" GET   "/api/defense/briefs/$CASE/audit/verify"
probe "GET eligible owners"  GET    "/api/defense/owners"
probe "POST graph simulate"  POST   "/api/graph/simulate" '{"graph":"supply_chain_deep"}'
probe "POST graph diff"      POST   "/api/graph/diff" '{"graph":"supply_chain_deep","beforeCommit":"0","afterCommit":"1"}'
echo

echo "5. What the agent can actually call"
echo "  Retrieval: get_weather_warning get_road_disruptions search_incidents"
echo "             get_route_characteristics get_traffic_speed get_live_weather_snapshot"
echo "             get_blast_radius replay_at"
echo "  Output:    draft_public_warning  create_human_review"
echo "  There is no approve, decide, assign, acknowledge, or outcome tool."
echo "  create_human_review hard-codes status pending, decidedAt null, and audit"
echo "  actor bothy-agent (apps/agent/src/agent/tools.ts:222-261), so approval is"
echo "  not a value the agent can supply."
echo

echo
if [ "$unconfigured" -eq 1 ]; then
  echo "State: UNCONFIGURED. The 503s show approval is disabled until a verified"
  echo "reviewer identity is configured (apps/agent/src/auth.ts:45). This proves the"
  echo "default is fail-closed. It does NOT by itself prove role separation, because"
  echo "nothing got far enough to be checked for a reviewer role."
  echo
  echo "For the stronger result, run the same script against the disposable-SSO agent,"
  echo "where an analyst token is refused with 403 and forged body fields with 400:"
  echo "  node scripts/demo-sso.mjs            # provider :9099, agent :8798, web :3001"
  echo "  AGENT_URL=http://localhost:8798 bash scripts/refusal-demo.sh"
  echo "Stop the venue stack first; both launchers want port 3001. See"
  echo "docs/demo-sso-rehearsal.md."
  echo
  echo "Role separation is asserted deterministically by the suite either way:"
  echo "  npm -w @bothy/agent test             # see auth.test.ts and defense.test.ts"
else
  echo "State: CONFIGURED. Refusals below are authorization decisions, not a disabled"
  echo "feature: wrong role is 403, forged identity or evidence in the body is 400,"
  echo "and token-supplied roles are ignored in favour of the server-side map."
fi
echo
if [ "$fail" -eq 0 ]; then
  echo "Result: every approval-capable surface refused. Nothing was written."
else
  echo "Result: at least one probe did not refuse. Investigate before using this as evidence."
fi
exit "$fail"
