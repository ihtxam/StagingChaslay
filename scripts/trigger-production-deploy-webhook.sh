#!/usr/bin/env bash
# Trigger production deploy via webhook (no GitHub Actions billing required).
#
# Usage:
#   DEPLOY_WEBHOOK_URL=https://app.rebornsense.com/internal/git-deploy \
#   DEPLOY_WEBHOOK_TOKEN=... \
#     bash scripts/trigger-production-deploy-webhook.sh
#
# Or from the production server (reads /root/chaslay-secrets/deploy-webhook.env):
#   bash /root/rebornSense/scripts/trigger-production-deploy-webhook.sh
set -euo pipefail

ENV_FILE="${DEPLOY_WEBHOOK_ENV_FILE:-/root/chaslay-secrets/deploy-webhook.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

URL="${DEPLOY_WEBHOOK_URL:-https://app.rebornsense.com${DEPLOY_WEBHOOK_PATH:-/internal/git-deploy}}"
TOKEN="${DEPLOY_WEBHOOK_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: set DEPLOY_WEBHOOK_TOKEN or create $ENV_FILE on the server"
  exit 1
fi

echo "POST $URL"
curl -fsS -X POST "$URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main","reason":"manual-trigger"}'
echo ""
