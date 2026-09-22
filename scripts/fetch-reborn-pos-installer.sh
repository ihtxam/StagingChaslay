#!/usr/bin/env bash
# Download the latest successful RebornPOS Windows installer artifact from GitHub Actions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REBORN_POS_DOWNLOADS_DIR:-$ROOT/backend/public/downloads}"
WORKFLOW="${REBORN_POS_WORKFLOW:-build-chaslay-pos-windows.yml}"
RUN_ID="${REBORN_POS_RUN_ID:-}"

mkdir -p "$OUT"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI is required to fetch RebornPOS Windows artifacts"
  exit 1
fi

if [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(gh run list --workflow "$WORKFLOW" --status success --limit 1 --json databaseId --jq '.[0].databaseId')"
fi

if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "ERROR: no successful RebornPOS Windows build found for workflow $WORKFLOW"
  exit 1
fi

echo "Fetching RebornPOS Windows installer from GitHub Actions run ${RUN_ID}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

gh run download "$RUN_ID" --dir "$TMP"

EXE="$(find "$TMP" -name 'reborn-pos-setup.exe' -type f | head -1)"
JSON="$(find "$TMP" -name 'reborn-pos-setup.json' -type f | head -1)"

if [[ -z "$EXE" || ! -f "$EXE" ]]; then
  echo "ERROR: reborn-pos-setup.exe not found in run ${RUN_ID} artifact"
  exit 1
fi

cp -f "$EXE" "$OUT/reborn-pos-setup.exe"
if [[ -f "$JSON" ]]; then
  cp -f "$JSON" "$OUT/reborn-pos-setup.json"
fi

if ! head -c 2 "$OUT/reborn-pos-setup.exe" | grep -q MZ; then
  echo "ERROR: reborn-pos-setup.exe is not a valid Windows PE (missing MZ header)"
  exit 1
fi

BYTES="$(wc -c < "$OUT/reborn-pos-setup.exe" | tr -d ' ')"
if [[ "$BYTES" -lt 1000000 ]]; then
  echo "ERROR: reborn-pos-setup.exe is too small (${BYTES} bytes)"
  exit 1
fi

echo "RebornPOS installer ready: $OUT/reborn-pos-setup.exe (${BYTES} bytes)"
if [[ -f "$OUT/reborn-pos-setup.json" ]]; then
  echo "Manifest: $OUT/reborn-pos-setup.json"
fi
