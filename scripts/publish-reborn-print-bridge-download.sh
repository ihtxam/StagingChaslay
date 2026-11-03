#!/usr/bin/env bash
# Copy Bridge Reborn APK + manifest to production downloads (merchant panel /downloads URLs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

SSH_ALIAS="${REBORN_BRIDGE_SSH_ALIAS:-${PRODUCTION_SSH_ALIAS:-production-reborn}}"
REMOTE_PATH="${REBORN_BRIDGE_REMOTE_PATH:-${PRODUCTION_DEPLOY_PATH:-/root/rebornSense}/backend/public/downloads}"
LOCAL_DIR="${REBORN_BRIDGE_DOWNLOADS_DIR:-$ROOT/backend/public/downloads}"

APK="$LOCAL_DIR/reborn-print-bridge.apk"
JSON="$LOCAL_DIR/reborn-print-bridge.json"

if [[ ! -f "$APK" ]]; then
  echo "ERROR: $APK missing — run: bash scripts/build-reborn-print-bridge-apk.sh"
  exit 1
fi

if ! head -c 2 "$APK" | grep -q PK; then
  echo "ERROR: $APK is not a valid APK (expected PK zip header)"
  exit 1
fi

VERSION="$(grep -E 'versionName\s*=' print-agent-android/app/build.gradle.kts | sed -E 's/.*"([^"]+)".*/\1/' | head -1)"
VERSIONED="$LOCAL_DIR/reborn-print-bridge-${VERSION}.apk"
if [[ -n "$VERSION" && -f "$APK" ]]; then
  cp -f "$APK" "$VERSIONED"
fi

echo "Publishing Bridge Reborn to ${SSH_ALIAS}:${REMOTE_PATH}"
ssh -o BatchMode=yes "$SSH_ALIAS" "mkdir -p '$REMOTE_PATH'"
scp -o BatchMode=yes "$APK" "${SSH_ALIAS}:${REMOTE_PATH}/reborn-print-bridge.apk"
if [[ -f "$VERSIONED" ]]; then
  scp -o BatchMode=yes "$VERSIONED" "${SSH_ALIAS}:${REMOTE_PATH}/$(basename "$VERSIONED")"
fi
if [[ -f "$JSON" ]]; then
  scp -o BatchMode=yes "$JSON" "${SSH_ALIAS}:${REMOTE_PATH}/reborn-print-bridge.json"
fi

REMOTE_BYTES="$(ssh -o BatchMode=yes "$SSH_ALIAS" "wc -c < '${REMOTE_PATH}/reborn-print-bridge.apk' | tr -d ' '")"
if [[ "${REMOTE_BYTES:-0}" -lt 100000 ]]; then
  echo "ERROR: remote reborn-print-bridge.apk is too small (${REMOTE_BYTES:-0} bytes)"
  exit 1
fi

LIVE_VER="$(curl -sf "https://app.rebornsense.com/downloads/reborn-print-bridge.json" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)"
echo "Published reborn-print-bridge.apk v${VERSION} (${REMOTE_BYTES} bytes)"
if [[ -n "$LIVE_VER" ]]; then
  if [[ "$LIVE_VER" == "$VERSION" ]]; then
    echo "Live manifest version OK: ${LIVE_VER}"
  else
    echo "WARNING: live JSON version=${LIVE_VER} (expected ${VERSION}) — CDN/cache or API reload may lag"
  fi
fi
