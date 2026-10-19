#!/usr/bin/env bash
# Copy RebornPOS Android APK + manifest to production downloads over SSH.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

SSH_ALIAS="${REBORN_POS_ANDROID_SSH_ALIAS:-${PRODUCTION_SSH_ALIAS:-production-reborn}}"
REMOTE_PATH="${REBORN_POS_ANDROID_REMOTE_PATH:-${PRODUCTION_DEPLOY_PATH:-/root/rebornSense}/backend/public/downloads}"
LOCAL_DIR="${REBORN_POS_ANDROID_DOWNLOADS_DIR:-$ROOT/backend/public/downloads}"
BUILD="${REBORN_POS_ANDROID_BUILD:-1}"

APK="$LOCAL_DIR/reborn-pos-android.apk"
JSON="$LOCAL_DIR/reborn-pos-android.json"

if [[ "$BUILD" == "1" ]]; then
  echo "Building RebornPOS Android release APK…"
  chmod +x ./gradlew
  ./gradlew :app:assembleRelease --no-daemon -g /tmp/gradle-pos-home
fi

if [[ ! -f "$APK" ]]; then
  echo "ERROR: $APK missing — run: ./gradlew :app:assembleRelease"
  exit 1
fi

if ! head -c 2 "$APK" | grep -q PK; then
  echo "ERROR: $APK is not a valid APK (expected PK zip header)"
  exit 1
fi

VERSION="$(grep -E 'versionName\s*=' app/build.gradle.kts | sed -E 's/.*"([^"]+)".*/\1/' | head -1)"
VERSIONED="$LOCAL_DIR/reborn-pos-android-${VERSION}.apk"
if [[ -n "$VERSION" && -f "$APK" ]]; then
  cp -f "$APK" "$VERSIONED"
fi

echo "Publishing RebornPOS Android to ${SSH_ALIAS}:${REMOTE_PATH}"
ssh -o BatchMode=yes "$SSH_ALIAS" "mkdir -p '$REMOTE_PATH'"
scp -o BatchMode=yes "$APK" "${SSH_ALIAS}:${REMOTE_PATH}/reborn-pos-android.apk"
if [[ -f "$VERSIONED" ]]; then
  scp -o BatchMode=yes "$VERSIONED" "${SSH_ALIAS}:${REMOTE_PATH}/$(basename "$VERSIONED")"
fi
if [[ -f "$JSON" ]]; then
  scp -o BatchMode=yes "$JSON" "${SSH_ALIAS}:${REMOTE_PATH}/reborn-pos-android.json"
fi

REMOTE_BYTES="$(ssh -o BatchMode=yes "$SSH_ALIAS" "wc -c < '${REMOTE_PATH}/reborn-pos-android.apk' | tr -d ' '")"
if [[ "${REMOTE_BYTES:-0}" -lt 500000 ]]; then
  echo "ERROR: remote reborn-pos-android.apk is too small (${REMOTE_BYTES:-0} bytes)"
  exit 1
fi

echo "Published reborn-pos-android.apk v${VERSION} (${REMOTE_BYTES} bytes)"
