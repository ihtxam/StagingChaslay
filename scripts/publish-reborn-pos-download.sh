#!/usr/bin/env bash
# Copy RebornPOS Windows installer + manifest to a remote downloads directory over SSH.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

SSH_ALIAS="${REBORN_POS_SSH_ALIAS:-${PRODUCTION_SSH_ALIAS:-production-reborn}}"
REMOTE_PATH="${REBORN_POS_REMOTE_PATH:-${PRODUCTION_DEPLOY_PATH:-/root/rebornSense}/backend/public/downloads}"
LOCAL_DIR="${REBORN_POS_DOWNLOADS_DIR:-$ROOT/backend/public/downloads}"
FETCH="${REBORN_POS_FETCH:-1}"

if [[ "$FETCH" == "1" ]]; then
  bash "$ROOT/scripts/fetch-reborn-pos-installer.sh"
fi

EXE="$LOCAL_DIR/reborn-pos-setup.exe"
JSON="$LOCAL_DIR/reborn-pos-setup.json"

if [[ ! -f "$EXE" ]]; then
  echo "ERROR: $EXE missing — run scripts/fetch-reborn-pos-installer.sh first"
  exit 1
fi

if ! head -c 2 "$EXE" | grep -q MZ; then
  echo "ERROR: $EXE is not a valid Windows PE"
  exit 1
fi

echo "Publishing RebornPOS installer to ${SSH_ALIAS}:${REMOTE_PATH}"
ssh -o BatchMode=yes "$SSH_ALIAS" "mkdir -p '$REMOTE_PATH'"
scp -o BatchMode=yes "$EXE" "${SSH_ALIAS}:${REMOTE_PATH}/reborn-pos-setup.exe"
if [[ -f "$JSON" ]]; then
  scp -o BatchMode=yes "$JSON" "${SSH_ALIAS}:${REMOTE_PATH}/reborn-pos-setup.json"
fi

REMOTE_BYTES="$(ssh -o BatchMode=yes "$SSH_ALIAS" "wc -c < '${REMOTE_PATH}/reborn-pos-setup.exe' | tr -d ' '")"
if [[ "${REMOTE_BYTES:-0}" -lt 1000000 ]]; then
  echo "ERROR: remote reborn-pos-setup.exe is too small (${REMOTE_BYTES:-0} bytes)"
  exit 1
fi

echo "Published reborn-pos-setup.exe (${REMOTE_BYTES} bytes) to ${SSH_ALIAS}:${REMOTE_PATH}"
