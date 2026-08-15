#!/usr/bin/env bash
# Pre-commit secret scanner.
# Scans the staged diff for high-signal secret material and blocks known
# secret files. Cheap, deterministic, and portable (macOS + GNU grep).
# Add `gitleaks detect --source .` in CI for a heavier, heuristic scan.
set -u

fail=0
echo "==> check-secrets: scanning staged changes"

# 1) Block recognizable secret files (allow .env.example / .env.sample).
if git diff --cached --name-only \
  | grep -Ev '(\.example|\.sample|\.template)$' \
  | grep -E '(^|/)(\.env|\.env\.[A-Za-z0-9]+|.*\.(pem|p12|pfx|key|keystore|jnlp))$' \
  | grep -q . ; then
  echo "    x a recognizable secret file (e.g. .env) is staged - refusing to commit it."
  fail=1
fi

# 2) Scan only the ADDED lines of the staged diff for secret patterns.
patch="$(git diff --cached --unified=0 --no-color)"

patterns=(
  'BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY'
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z_-]{35}'
  'ghp_[A-Za-z0-9]{36}'
  'sk-ant-api[0-9]{1,6}-[A-Za-z0-9_-]{20,}'
  '(ANTHROPIC_API_KEY|OPENAI_API_KEY|STRIPE_SECRET_KEY|AWS_SECRET_ACCESS_KEY|GH_TOKEN|GITHUB_TOKEN|GOOGLE_API_KEY)=[^ ;]{8,}'
)

for pat in "${patterns[@]}"; do
  if printf '%s\n' "$patch" | grep '^+' | grep -Ee "$pat" | grep -q . ; then
    echo "    x possible secret matched: $pat"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "==> x pre-commit secret scan FAILED - review staged changes before committing."
  exit 1
fi
echo "==> ✔ No obvious secrets staged."
exit 0