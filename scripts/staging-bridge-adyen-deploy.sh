#!/usr/bin/env bash
# Add Adyen POS Mobile SDK keys to staging secrets and rebuild Bridge APK with Tap to Pay.
#
# Usage:
#   ADYEN_SDK_API_KEY_TEST='your-test-key' ADYEN_SDK_API_KEY_LIVE='your-live-key' \
#     bash scripts/staging-bridge-adyen-deploy.sh
#
# Legacy alias:
#   ADYEN_SDK_API_KEY='your-test-key' bash scripts/staging-bridge-adyen-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

STAGING_SSH_ALIAS="${STAGING_SSH_ALIAS:-staging-chaslay}"
STAGING_DEPLOY_PATH="${STAGING_DEPLOY_PATH:-/root/StagingChaslay}"
TEST_KEY="${ADYEN_SDK_API_KEY_TEST:-${ADYEN_SDK_API_KEY:-}}"
LIVE_KEY="${ADYEN_SDK_API_KEY_LIVE:-}"
ENV_NAME="${ADYEN_SDK_ENV:-}"

if [[ -z "$TEST_KEY" && -z "$LIVE_KEY" ]]; then
  echo "ERROR: Set ADYEN_SDK_API_KEY_TEST and/or ADYEN_SDK_API_KEY_LIVE (POS Mobile SDK keys from Adyen Customer Area)."
  exit 1
fi

if [[ -z "$ENV_NAME" ]]; then
  if [[ -n "$TEST_KEY" ]]; then
    ENV_NAME="test"
  else
    ENV_NAME="live"
  fi
fi

PAYLOAD_B64="$(python3 - "$TEST_KEY" "$LIVE_KEY" "$ENV_NAME" "$STAGING_DEPLOY_PATH" <<'PY' | base64 -w0
import json, sys
print(json.dumps({
    "adyen_sdk_api_key_test": sys.argv[1],
    "adyen_sdk_api_key_live": sys.argv[2],
    "adyen_sdk_env": sys.argv[3],
    "deploy_path": sys.argv[4],
}))
PY
)"

ssh -o BatchMode=yes "$STAGING_SSH_ALIAS" "PAYLOAD_B64='$PAYLOAD_B64' bash -s" <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import base64, json, os, re, subprocess

payload = json.loads(base64.b64decode(os.environ["PAYLOAD_B64"]))
env_file = "/root/chaslay-secrets/.env.production"
updates = {}
if payload["adyen_sdk_api_key_test"]:
    updates["ADYEN_SDK_API_KEY_TEST"] = payload["adyen_sdk_api_key_test"]
if payload["adyen_sdk_api_key_live"]:
    updates["ADYEN_SDK_API_KEY_LIVE"] = payload["adyen_sdk_api_key_live"]
updates["ADYEN_SDK_ENV"] = payload["adyen_sdk_env"]

lines = []
if os.path.isfile(env_file):
    with open(env_file, encoding="utf-8") as handle:
        lines = handle.read().splitlines()

out = []
seen = set()
for line in lines:
    matched = re.match(r"^([A-Z0-9_]+)=", line)
    if not matched:
        out.append(line)
        continue
    name = matched.group(1)
    if name in updates:
        out.append(f"{name}={updates[name]}")
        seen.add(name)
    else:
        out.append(line)

for name, value in updates.items():
    if name not in seen:
        out.append(f"{name}={value}")

with open(env_file, "w", encoding="utf-8") as handle:
    handle.write("\n".join(out).rstrip() + "\n")

for name in ("ADYEN_SDK_API_KEY_TEST", "ADYEN_SDK_API_KEY_LIVE", "ADYEN_SDK_ENV"):
    if name in updates:
        print(f"Updated secrets: {name} len={len(updates[name])}")

deploy_path = payload["deploy_path"]
subprocess.run(
    [
        "bash",
        "-lc",
        f"export DEPLOY_STACK=chaslay DEPLOY_PATH={deploy_path} SKIP_GIT_SYNC=1 && "
        f"cd {deploy_path} && bash scripts/deploy-hetzner.sh",
    ],
    check=True,
)
PY
REMOTE

echo "=== Staging Bridge Tap-to-Pay deploy finished ==="
curl -fsS "https://app.chaslay.com/downloads/reborn-print-bridge.json" | python3 -m json.tool
