#!/usr/bin/env bash
# Reset demo merchant login on staging (app.chaslay.com).
# Safe to re-run — idempotent seed updates password when SEED_DEMO_RESET_PASSWORD is not false.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Chaslay staging walkthrough account (aliases demo@rebornsense.com still resolve via seed heal)
export SEED_DEMO_MERCHANT_EMAIL="${SEED_DEMO_MERCHANT_EMAIL:-demo@chaslay.com}"
export SEED_DEMO_MERCHANT_PASSWORD="${SEED_DEMO_MERCHANT_PASSWORD:-DemoShop123!}"
export SEED_DEMO_SLUG="${SEED_DEMO_SLUG:-demo}"
export SEED_DEMO_SLUG_ALIASES="${SEED_DEMO_SLUG_ALIASES:-demo,polacafe}"
export SEED_DEMO_RESET_PASSWORD="${SEED_DEMO_RESET_PASSWORD:-true}"

echo "Healing demo merchant: ${SEED_DEMO_MERCHANT_EMAIL} (slugs=${SEED_DEMO_SLUG_ALIASES})"

if docker compose ps api 2>/dev/null | grep -q Up; then
  docker compose run --rm \
    -e SEED_DEMO_MERCHANT_EMAIL \
    -e SEED_DEMO_MERCHANT_PASSWORD \
    -e SEED_DEMO_SLUG \
    -e SEED_DEMO_SLUG_ALIASES \
    -e SEED_DEMO_RESET_PASSWORD \
    migrate npx tsx src/db/seed.ts
else
  (cd backend && npx tsx src/db/seed.ts)
fi

echo "Done. Try login at https://app.chaslay.com with:"
echo "  Email:    ${SEED_DEMO_MERCHANT_EMAIL}"
echo "  Password: ${SEED_DEMO_MERCHANT_PASSWORD}"
