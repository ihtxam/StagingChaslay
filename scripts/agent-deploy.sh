#!/usr/bin/env bash
# Cloud Agent deploy helper — staging first, production after sign-off.
#
# Usage:
#   bash scripts/agent-deploy.sh staging     # merge path: wait for GH sync + optional SSH deploy
#   bash scripts/agent-deploy.sh production
#   bash scripts/agent-deploy.sh both        # staging then production (use after user confirms)
#   bash scripts/agent-deploy.sh staging-ssh # direct SSH deploy on staging server (fast path)
#   bash scripts/agent-deploy.sh production-ssh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 staging|production|both|staging-ssh|production-ssh"
  exit 1
fi

# Load SSH aliases from cloud-agent install when present.
if [[ -f "${HOME}/.reborn-agent-env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.reborn-agent-env"
fi

STAGING_SSH_ALIAS="${STAGING_SSH_ALIAS:-staging-chaslay}"
STAGING_DEPLOY_PATH="${STAGING_DEPLOY_PATH:-/root/StagingChaslay}"
STAGING_DEPLOY_STACK="${STAGING_DEPLOY_STACK:-chaslay}"
PRODUCTION_SSH_ALIAS="${PRODUCTION_SSH_ALIAS:-production-reborn}"
PRODUCTION_DEPLOY_PATH="${PRODUCTION_DEPLOY_PATH:-/root/rebornSense}"
PRODUCTION_DEPLOY_STACK="${PRODUCTION_DEPLOY_STACK:-rebornsense}"

wait_for_workflow() {
  local workflow="$1"
  local timeout_sec="${2:-900}"
  echo "Waiting for GitHub Actions workflow: ${workflow}"
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not available — check Actions manually: https://github.com/ihtxam/rebornSense/actions"
    return 0
  fi
  local run_id
  run_id="$(gh run list --workflow "$workflow" --limit 1 --json databaseId,status --jq '.[0].databaseId')"
  if [[ -z "$run_id" || "$run_id" == "null" ]]; then
    echo "No recent run found for ${workflow}"
    return 0
  fi
  gh run watch "$run_id" --exit-status --interval 10 || {
    echo "Workflow ${workflow} did not succeed (run ${run_id})"
    return 1
  }
}

wait_staging_health() {
  local url="${STAGING_HEALTH_URL:-https://app.chaslay.com/api/health}"
  local tries="${1:-30}"
  echo "Waiting for staging health: ${url}"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS --max-time 20 "$url" >/dev/null 2>&1; then
      echo "Staging health OK"
      return 0
    fi
    sleep 10
  done
  echo "Staging health check timed out"
  return 1
}

deploy_staging_ssh() {
  echo "=== Direct SSH deploy: staging (${STAGING_SSH_ALIAS}) ==="
  ssh -o BatchMode=yes "$STAGING_SSH_ALIAS" bash -s <<EOF
set -euo pipefail
export DEPLOY_STACK=${STAGING_DEPLOY_STACK}
export DEPLOY_PATH=${STAGING_DEPLOY_PATH}
export CADDYFILE="\${DEPLOY_PATH}/deploy/Caddyfile.chaslay"
cd "\${DEPLOY_PATH}"
git fetch origin main
git reset --hard origin/main
bash scripts/deploy-hetzner.sh
EOF
}

deploy_production_ssh() {
  echo "=== Direct SSH deploy: production (${PRODUCTION_SSH_ALIAS}) ==="
  ssh -o BatchMode=yes "$PRODUCTION_SSH_ALIAS" bash -s <<EOF
set -euo pipefail
export DEPLOY_STACK=${PRODUCTION_DEPLOY_STACK}
export DEPLOY_PATH=${PRODUCTION_DEPLOY_PATH}
export CADDYFILE="\${DEPLOY_PATH}/deploy/Caddyfile.rebornsense"
cd "\${DEPLOY_PATH}"
git fetch origin main
git reset --hard origin/main
bash scripts/deploy-hetzner.sh
EOF
}

deploy_staging_github() {
  echo "=== Staging via GitHub (sync StagingChaslay → auto deploy) ==="
  echo "Ensure latest code is on rebornSense main (merge PR + push first)."
  if command -v gh >/dev/null 2>&1; then
    gh workflow run sync-staging-chaslay.yml --ref main -f force_push=true
    wait_for_workflow sync-staging-chaslay.yml 600
  else
    echo "Push to main already triggers sync-staging-chaslay.yml on merge."
  fi
  wait_staging_health 36 || true
}

deploy_production_github() {
  echo "=== Production deploy (app.rebornsense.com) ==="
  if command -v gh >/dev/null 2>&1; then
    gh workflow run deploy-rebornsense.yml --ref main -f ref=main
    wait_for_workflow deploy-rebornsense.yml 1200
    return
  fi
  echo "gh CLI unavailable — falling back to deploy trigger commit"
  local stamp
  stamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  cat >.deploy/rebornsense-production <<EOF
# Touch this file and push to main to deploy app.rebornsense.com (triggers Deploy to Rebornsense workflow).
# Last deploy request: ${stamp} — cloud agent deploy
EOF
  git add .deploy/rebornsense-production
  if git diff --staged --quiet; then
    echo "No deploy trigger change to commit"
  else
    git commit -m "chore: deploy to Rebornsense production (cloud agent)"
    git push -u origin main
  fi
  wait_for_workflow deploy-rebornsense.yml 1200
}

case "$TARGET" in
  staging)
    deploy_staging_github
    ;;
  staging-ssh)
    deploy_staging_ssh
    wait_staging_health 36 || true
    ;;
  production)
    deploy_production_github
    ;;
  production-ssh)
    deploy_production_ssh
    ;;
  both)
    deploy_staging_github
    deploy_production_github
    ;;
  *)
    echo "Unknown target: $TARGET"
    exit 1
    ;;
esac

echo "Done: $TARGET"
