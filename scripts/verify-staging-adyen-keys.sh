#!/usr/bin/env bash
# Print Adyen POS Mobile SDK key presence on staging-chaslay (names + value lengths only).
#
# Usage:
#   bash scripts/verify-staging-adyen-keys.sh
#
# Requires SSH alias staging-chaslay (see scripts/cloud-agent-setup-ssh.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

STAGING_SSH_ALIAS="${STAGING_SSH_ALIAS:-staging-chaslay}"
SECRETS_FILE="${CHASLAY_SECRETS_FILE:-/root/chaslay-secrets/.env.production}"
REPO_ENV_LINK="${STAGING_DEPLOY_PATH:-/root/StagingChaslay}/.env.production"

echo "Checking Adyen SDK keys on ${STAGING_SSH_ALIAS}"
echo "Canonical secrets file: ${SECRETS_FILE}"
echo "Repo env symlink: ${REPO_ENV_LINK}"
echo ""

ssh -o BatchMode=yes "$STAGING_SSH_ALIAS" "SECRETS_FILE='$SECRETS_FILE' REPO_ENV_LINK='$REPO_ENV_LINK' bash -s" <<'REMOTE'
set -euo pipefail

report_env_file() {
  local label="$1"
  local path="$2"
  echo "=== ${label}: ${path} ==="
  if [[ ! -e "$path" ]]; then
    echo "  (missing)"
    return
  fi
  if [[ -L "$path" ]]; then
    echo "  symlink -> $(readlink -f "$path")"
  fi
  python3 - "$path" <<'PY'
import pathlib, re, sys

path = pathlib.Path(sys.argv[1])
names = [
    "ADYEN_SDK_API_KEY_TEST",
    "ADYEN_SDK_API_KEY_LIVE",
    "ADYEN_SDK_API_KEY",
    "ADYEN_SDK_KEY_TEST",
    "ADYEN_SDK_KEY_LIVE",
    "ADYEN_SDK_ENV",
]
text = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
for name in names:
    match = re.search(rf"^{name}=(.*)$", text, re.M)
    if not match:
        print(f"  {name}: absent")
        continue
    value = match.group(1).strip().strip('"').strip("'")
    state = "empty" if not value else f"length={len(value)}"
    print(f"  {name}: present ({state})")
PY
  echo ""
}

report_env_file "Secrets" "$SECRETS_FILE"
report_env_file "Repo link" "$REPO_ENV_LINK"

echo "=== .env* under /root containing ADYEN_SDK (filenames only) ==="
found=false
while IFS= read -r file; do
  if grep -q 'ADYEN_SDK' "$file" 2>/dev/null; then
    found=true
    echo "  $file"
    grep -E '^[A-Z0-9_]*ADYEN_SDK[A-Z0-9_]*=' "$file" 2>/dev/null | while IFS= read -r line; do
      key="${line%%=*}"
      value="${line#*=}"
      value="${value%$'\r'}"
      value="${value#\"}"; value="${value%\"}"
      value="${value#\'}"; value="${value%\'}"
      if [[ -n "$value" ]]; then
        echo "    ${key}: length=${#value}"
      else
        echo "    ${key}: empty"
      fi
    done
  fi
done < <(find /root -maxdepth 4 \( -name '.env' -o -name '.env.*' \) -type f 2>/dev/null | sort)

if ! $found; then
  echo "  (none)"
fi
REMOTE

echo ""
echo "Deploy reads: ADYEN_SDK_API_KEY_TEST (or ADYEN_SDK_API_KEY), ADYEN_SDK_API_KEY_LIVE, ADYEN_SDK_ENV"
echo "Edit on server: ${SECRETS_FILE}"
