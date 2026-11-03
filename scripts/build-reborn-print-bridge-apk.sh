#!/usr/bin/env bash
# Build Bridge Reborn release APK into backend/public/downloads/ (no full deploy).
# Uses Gradle on the host (same as GitHub Actions). Optional Docker image for old setups.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

USE_DOCKER="${BRIDGE_APK_USE_DOCKER:-0}"
DOWNLOADS="${BRIDGE_DOWNLOADS_DIR:-$ROOT/backend/public/downloads}"
mkdir -p "$DOWNLOADS"

BRIDGE_VERSION="$(grep -E 'versionName\s*=' print-agent-android/app/build.gradle.kts | sed -E 's/.*"([^"]+)".*/\1/' | head -1)"
[[ -n "$BRIDGE_VERSION" ]] || BRIDGE_VERSION="0.0.0"
BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

build_gradle() {
  chmod +x "$ROOT/print-agent-android/gradlew"
  (
    cd "$ROOT/print-agent-android"
    ./gradlew assembleRelease --no-daemon --no-build-cache
  )
  local apk
  apk="$(find "$ROOT/print-agent-android/app/build/outputs/apk/release" -name '*.apk' | head -1)"
  [[ -n "$apk" ]] || { echo "ERROR: no release APK under print-agent-android/app/build"; exit 1; }
  cp -f "$apk" "$DOWNLOADS/reborn-print-bridge.apk"
}

build_docker() {
  local keystore_mount=()
  local host_ks="$ROOT/.secrets/bridge-release.keystore"
  if [[ -f "$host_ks" ]]; then
    keystore_mount=(-v "$host_ks:/project/.secrets/bridge-release.keystore:ro")
    local lp="$ROOT/print-agent-android/local.properties"
    touch "$lp"
    for line in \
      "bridgeStoreFile=.secrets/bridge-release.keystore" \
      "bridgeStorePassword=${BRIDGE_KEYSTORE_PASSWORD:-android}" \
      "bridgeKeyAlias=${BRIDGE_KEY_ALIAS:-bridge}" \
      "bridgeKeyPassword=${BRIDGE_KEY_PASSWORD:-android}"; do
      key="${line%%=*}"
      if grep -q "^${key}=" "$lp" 2>/dev/null; then
        sed -i "s|^${key}=.*|${line}|" "$lp"
      else
        echo "$line" >> "$lp"
      fi
    done
  fi
  docker run --rm \
    -e ANDROID_SDK_ROOT=/opt/android-sdk-linux \
    -e GRADLE_USER_HOME=/tmp/gradle-home \
    -v "$ROOT/print-agent-android:/project" \
    -v "$DOWNLOADS:/out" \
    "${keystore_mount[@]}" \
    -w /project \
    mingc/android-build-box:latest \
    bash -c 'set -euo pipefail
      export GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false"
      rm -rf /project/.gradle /project/app/build /tmp/gradle-home /tmp/gradle-project-cache
      mkdir -p /tmp/gradle-home /tmp/gradle-project-cache
      chmod +x ./gradlew
      ./gradlew assembleRelease --no-daemon --no-build-cache -g /tmp/gradle-home --project-cache-dir=/tmp/gradle-project-cache
      APK="$(find app/build/outputs/apk/release -name "*.apk" | head -1)"
      test -n "$APK"
      cp -f "$APK" /out/reborn-print-bridge.apk
    '
}

if [[ "$USE_DOCKER" == "1" ]]; then
  echo "Building Bridge APK v${BRIDGE_VERSION} (Docker mingc/android-build-box)…"
  build_docker
else
  echo "Building Bridge APK v${BRIDGE_VERSION} (Gradle on host)…"
  build_gradle
fi

APK="$DOWNLOADS/reborn-print-bridge.apk"
if ! head -c 2 "$APK" | grep -q PK; then
  echo "ERROR: $APK is not a valid APK (expected PK zip header)"
  exit 1
fi

APK_VERSION="$(python3 - <<'PY' "$APK"
import re, sys, zipfile
apk = sys.argv[1]
with zipfile.ZipFile(apk) as z:
    data = z.read("AndroidManifest.xml")
vers = set()
for i in range(len(data) - 6):
    if data[i] == 0x30 and data[i+1] == 0 and data[i+2] == 0x2e and data[i+3] == 0:
        j, s = i, ""
        while j + 1 < len(data):
            lo, hi = data[j], data[j+1]
            if hi or lo == 0 or not ((0x30 <= lo <= 0x39) or lo == 0x2e):
                break
            s += chr(lo)
            j += 2
        if re.fullmatch(r"0\.\d+\.\d+", s):
            vers.add(s)
print(sorted(vers)[-1] if vers else "")
PY
)"
if [[ -n "$APK_VERSION" && "$APK_VERSION" != "$BRIDGE_VERSION" ]]; then
  echo "ERROR: APK versionName=$APK_VERSION but build.gradle has $BRIDGE_VERSION"
  exit 1
fi

cp -f "$APK" "$DOWNLOADS/reborn-print-bridge-${BRIDGE_VERSION}.apk"

MANIFEST="$DOWNLOADS/reborn-print-bridge.json"
python3 - <<PY
import json, datetime
from pathlib import Path
p = Path("$MANIFEST")
data = json.loads(p.read_text()) if p.is_file() else {
    "name": "reborn-print-bridge",
    "displayName": "Bridge Reborn",
    "description": "WebPOS companion for Android — printing and NFC tap-to-pay.",
    "apkFile": "reborn-print-bridge.apk",
    "platform": "android",
}
data["version"] = "$BRIDGE_VERSION"
data["builtAt"] = "$BUILT_AT"
data["signed"] = True
p.write_text(json.dumps(data, indent=2) + "\n")
PY

BYTES="$(wc -c < "$APK" | tr -d ' ')"
echo "OK: reborn-print-bridge.apk v${BRIDGE_VERSION} (${BYTES} bytes) → $DOWNLOADS"
