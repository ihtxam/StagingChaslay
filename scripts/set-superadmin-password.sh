#!/usr/bin/env bash
# Set the panel superadmin password on the running API container.
# Updates the database hash only. Does not print the password.
# Does not invent or assume a live production password.
#
# Read the configured seed email (do not share the env file):
#   grep SEED_SUPERADMIN /root/chaslay-secrets/backend.env
#
# Set a new password (on the server, from the app repo):
#   bash scripts/set-superadmin-password.sh 'YourNewPassword123'
#   bash scripts/set-superadmin-password.sh 'YourNewPassword123' admin@rebornsense.com
#
# Superadmin can also use Forgot password on /login (Brevo must be configured).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASSWORD="${1:-}"
EMAIL="${2:-}"
if [[ -z "$PASSWORD" ]]; then
  echo "Usage: bash scripts/set-superadmin-password.sh '<new-password>' [email]"
  echo "Read seed email: grep SEED_SUPERADMIN /root/chaslay-secrets/backend.env"
  exit 1
fi
if [[ "${#PASSWORD}" -lt 8 ]]; then
  echo "Password must be at least 8 characters."
  exit 1
fi
ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="/root/chaslay-secrets/backend.env"
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "No env file found (.env.production or /root/chaslay-secrets/backend.env)."
  exit 1
fi
SEED_EMAIL="$(grep -E '^SEED_SUPERADMIN_EMAIL=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
echo "Using env file: $ENV_FILE"
if [[ -n "$SEED_EMAIL" ]]; then
  echo "SEED_SUPERADMIN_EMAIL in env file: $SEED_EMAIL"
fi
if [[ -n "$EMAIL" ]]; then
  echo "Updating superadmin password for: $EMAIL"
  docker compose --env-file "$ENV_FILE" exec -T api npm run set-superadmin-password -- "$PASSWORD" "$EMAIL"
else
  echo "Updating the existing superadmin (email from container env / first row)."
  docker compose --env-file "$ENV_FILE" exec -T api npm run set-superadmin-password -- "$PASSWORD"
fi
