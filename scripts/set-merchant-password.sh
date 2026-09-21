#!/usr/bin/env bash
# Set a merchant owner password on the running API container.
# Updates the database hash only. Does not print the password.
#
#   bash scripts/set-merchant-password.sh 'YourNewPassword123' info@example.com
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASSWORD="${1:-}"
EMAIL="${2:-}"
if [[ -z "$PASSWORD" || -z "$EMAIL" ]]; then
  echo "Usage: bash scripts/set-merchant-password.sh '<new-password>' <email>"
  exit 1
fi
if [[ "${#PASSWORD}" -lt 8 ]]; then
  echo "Password must be at least 8 characters."
  exit 1
fi
ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="/root/chaslay-secrets/.env.production"
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "No env file found (.env.production or /root/chaslay-secrets/.env.production)."
  exit 1
fi
echo "Updating merchant password for: $EMAIL"
docker compose --env-file "$ENV_FILE" exec -T api npm run set-merchant-password -- "$PASSWORD" "$EMAIL"
