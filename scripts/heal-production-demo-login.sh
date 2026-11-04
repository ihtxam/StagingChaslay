#!/usr/bin/env bash
# Reset demo merchant owner login on production (app.rebornsense.com / PolaCafe showcase).
# Safe to re-run — idempotent; only touches the resolved demo showcase merchant.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export SEED_DEMO_MERCHANT_EMAIL="${SEED_DEMO_MERCHANT_EMAIL:-demo@chaslay.com}"
export SEED_DEMO_MERCHANT_PASSWORD="${SEED_DEMO_MERCHANT_PASSWORD:-DemoShop123!}"
export SEED_DEMO_SLUG="${SEED_DEMO_SLUG:-polacafe}"
export SEED_DEMO_SLUG_ALIASES="${SEED_DEMO_SLUG_ALIASES:-polacafe,demo}"
export SEED_DEMO_RESET_PASSWORD="${SEED_DEMO_RESET_PASSWORD:-true}"

echo "Healing production demo merchant: ${SEED_DEMO_MERCHANT_EMAIL} (slugs=${SEED_DEMO_SLUG_ALIASES})"

run_heal() {
  npx tsx src/scripts/heal-demo-login.ts
}

if docker compose ps api 2>/dev/null | grep -q Up; then
  docker compose run --rm \
    -e SEED_DEMO_MERCHANT_EMAIL \
    -e SEED_DEMO_MERCHANT_PASSWORD \
    -e SEED_DEMO_SLUG \
    -e SEED_DEMO_SLUG_ALIASES \
    -e SEED_DEMO_RESET_PASSWORD \
    migrate sh -c "npx tsx src/scripts/heal-demo-login.ts"
else
  (cd backend && run_heal)
fi

echo "Done. Owner login at https://app.rebornsense.com"
echo "  Email:    ${SEED_DEMO_MERCHANT_EMAIL}"
echo "  Password: ${SEED_DEMO_MERCHANT_PASSWORD}"
