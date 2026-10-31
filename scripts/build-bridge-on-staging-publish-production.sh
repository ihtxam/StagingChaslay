#!/usr/bin/env bash
# Build Bridge APK on the staging VPS (heavy Gradle/Docker stays off production), then publish to app.rebornsense.com.
#
# Requires SSH config (see DEPLOY.md):
#   staging-chaslay  → StagingChaslay @ app.chaslay.com
#   production-reborn → rebornSense @ app.rebornsense.com
#
# Usage:
#   bash scripts/build-bridge-on-staging-publish-production.sh
#   BRIDGE_APK_USE_DOCKER=1 bash scripts/build-bridge-on-staging-publish-production.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

STAGING_SSH="${STAGING_SSH_ALIAS:-staging-chaslay}"
STAGING_PATH="${STAGING_DEPLOY_PATH:-/root/StagingChaslay}"
USE_DOCKER="${BRIDGE_APK_USE_DOCKER:-0}"
LOCAL_DIR="$ROOT/backend/public/downloads"
mkdir -p "$LOCAL_DIR"

echo "=== 1/3 Build Bridge APK on staging (${STAGING_SSH}:${STAGING_PATH}) ==="
ssh -o BatchMode=yes "$STAGING_SSH" bash -s <<EOF
set -euo pipefail
cd "$STAGING_PATH"
git fetch origin main 2>/dev/null || true
git checkout main 2>/dev/null || true
git pull --ff-only origin main 2>/dev/null || true
export BRIDGE_APK_USE_DOCKER=$USE_DOCKER
bash scripts/build-reborn-print-bridge-apk.sh
EOF

echo "=== 2/3 Copy APK from staging to this machine ==="
scp -o BatchMode=yes \
  "${STAGING_SSH}:${STAGING_PATH}/backend/public/downloads/reborn-print-bridge.apk" \
  "${STAGING_SSH}:${STAGING_PATH}/backend/public/downloads/reborn-print-bridge.json" \
  "$LOCAL_DIR/"

VERSION="$(grep -E 'versionName\s*=' print-agent-android/app/build.gradle.kts | sed -E 's/.*"([^"]+)".*/\1/' | head -1)"
if [[ -n "$VERSION" ]]; then
  scp -o BatchMode=yes \
    "${STAGING_SSH}:${STAGING_PATH}/backend/public/downloads/reborn-print-bridge-${VERSION}.apk" \
    "$LOCAL_DIR/" 2>/dev/null || cp -f "$LOCAL_DIR/reborn-print-bridge.apk" "$LOCAL_DIR/reborn-print-bridge-${VERSION}.apk"
fi

echo "=== 3/3 Publish to production downloads (merchant panel) ==="
bash "$ROOT/scripts/publish-reborn-print-bridge-download.sh"

echo "Done. Merchants install from Settings → Receipts & printers → Bridge Reborn (app.rebornsense.com/downloads)."
