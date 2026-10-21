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

PROD_BASE="${REBORN_POS_PROD_DOWNLOADS:-https://app.rebornsense.com/downloads}"

if [[ "${REBORN_POS_FETCH_FROM_PROD:-1}" == "1" ]]; then
  echo "Trying production downloads at ${PROD_BASE}/reborn-pos-setup.exe"
  if curl -fsSL "${PROD_BASE}/reborn-pos-setup.exe" -o "$OUT/reborn-pos-setup.exe" \
    && curl -fsSL "${PROD_BASE}/reborn-pos-setup.json" -o "$OUT/reborn-pos-setup.json" 2>/dev/null; then
    EXE="$OUT/reborn-pos-setup.exe"
    JSON="$OUT/reborn-pos-setup.json"
  else
    rm -f "$OUT/reborn-pos-setup.exe" "$OUT/reborn-pos-setup.json"
    EXE=""
  fi
else
  EXE=""
fi

if [[ -z "${EXE:-}" || ! -f "$EXE" ]]; then
  if [[ -z "$RUN_ID" ]]; then
    RUN_ID="$(gh run list --workflow "$WORKFLOW" --status success --limit 1 --json databaseId --jq '.[0].databaseId')"
  fi

  if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
    echo "ERROR: no RebornPOS Windows installer on production and no successful workflow $WORKFLOW run"
    echo "Hint: run Build RebornPOS Windows on main, or build locally:"
    echo "  powershell -ExecutionPolicy Bypass -File scripts/build-reborn-pos-windows.ps1 -Publish"
    exit 1
  fi

  echo "Fetching RebornPOS Windows installer from GitHub Actions run ${RUN_ID} (legacy artifact)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  if ! gh run download "$RUN_ID" --dir "$TMP" 2>/dev/null; then
    echo "ERROR: could not download artifact (storage quota or CI no longer uploads artifacts)"
    echo "Use production URL or rebuild: REBORN_POS_FETCH_FROM_PROD=1 (default) or local build script"
    exit 1
  fi

  EXE="$(find "$TMP" -name 'reborn-pos-setup.exe' -type f | head -1)"
  JSON="$(find "$TMP" -name 'reborn-pos-setup.json' -type f | head -1)"
fi

if [[ -z "$EXE" || ! -f "$EXE" ]]; then
  echo "ERROR: reborn-pos-setup.exe not found"
  exit 1
fi

if [[ "$EXE" != "$OUT/reborn-pos-setup.exe" ]]; then
  cp -f "$EXE" "$OUT/reborn-pos-setup.exe"
fi
if [[ -n "${JSON:-}" && -f "$JSON" && "$JSON" != "$OUT/reborn-pos-setup.json" ]]; then
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
