#!/usr/bin/env bash
# Set the panel superadmin password on the running API container.
# Usage (on the server):
#   bash scripts/set-superadmin-password.sh 'YourNewPassword123'
#   bash scripts/set-superadmin-password.sh 'YourNewPassword123' admin@chaslay.com
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASSWORD="${1:-}"
EMAIL="${2:-}"
if [[ -z "$PASSWORD" ]]; then
  echo "Usage: bash scripts/set-superadmin-password.sh '<new-password>' [email]"
  exit 1
fi
ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="/root/chaslay-secrets/backend.env"
fi
if [[ -n "$EMAIL" ]]; then
  docker compose --env-file "$ENV_FILE" exec -T api npm run set-superadmin-password -- "$PASSWORD" "$EMAIL"
else
  docker compose --env-file "$ENV_FILE" exec -T api npm run set-superadmin-password -- "$PASSWORD"
fi
