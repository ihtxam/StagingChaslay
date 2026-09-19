#!/usr/bin/env bash
# Apply merchant column patches on staging when schema-repair cannot heal via API alone.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

POSTGRES_USER="${POSTGRES_USER:-manupos}"
POSTGRES_DB="${POSTGRES_DB:-manupos}"

echo "Applying merchant column SQL patches..."
if docker compose ps db 2>/dev/null | grep -q Up; then
  docker compose exec -T db \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    < "$ROOT/backend/sql/ensure-merchant-columns-drift.sql"
  docker compose run --rm migrate npx tsx src/db/run-schema-patches.ts || true
else
  echo "db container not running — start stack first"
  exit 1
fi

echo "Done. Verify: curl -X POST https://app.chaslay.com/api/health/schema-repair"
