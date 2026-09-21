#!/usr/bin/env bash
# Rebuild public.merchants on Postgres when pg_attribute slots are exhausted by dropped columns.
# Preserves merchant rows and child-table foreign keys. Does NOT wipe orders/products/customers.
#
# Usage (on the server, from repo root):
#   REBUILD_MERCHANTS_TABLE=1 bash scripts/rebuild-merchants-table.sh
#
# Optional:
#   ENV_FILE=/root/chaslay-secrets/.env.production
#   SKIP_API_STOP=1   # keep API running (not recommended)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${REBUILD_MERCHANTS_TABLE:-}" != "1" ]]; then
  echo "Refusing to rebuild merchants without explicit confirmation."
  echo "  REBUILD_MERCHANTS_TABLE=1 bash scripts/rebuild-merchants-table.sh"
  exit 1
fi

ENV_FILE="${ENV_FILE:-.env.production}"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="/root/chaslay-secrets/.env.production"
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "No env file found (.env.production or /root/chaslay-secrets/.env.production)."
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-manupos}"
POSTGRES_DB="${POSTGRES_DB:-manupos}"
BACKUP_DIR="${BACKUP_DIR:-/root/reborn-secrets/backups}"
TS="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_FILE="$BACKUP_DIR/merchants-pre-rebuild-$TS.sql"

mkdir -p "$BACKUP_DIR"

dc() {
  docker compose --env-file "$ENV_FILE" "$@"
}

echo "=== merchants table rebuild @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
echo "Using env file: $ENV_FILE"

before_attnum="$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.merchants'::regclass AND attnum > 0;" \
  | tr -d '[:space:]')"
before_rows="$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT count(*) FROM merchants;" | tr -d '[:space:]')"
echo "Before: pg_attribute=${before_attnum:-?} merchant_rows=${before_rows:-?}"

echo "=== Backup merchants table ==="
dc exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t public.merchants --data-only --column-inserts \
  >"$BACKUP_FILE"
echo "Backup written: $BACKUP_FILE"

if [[ "${SKIP_API_STOP:-}" != "1" ]]; then
  echo "=== Pause API during rebuild ==="
  dc stop api 2>/dev/null || true
fi

echo "=== Rebuild merchants table ==="
dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  < "$ROOT/backend/sql/rebuild-merchants-table.sql"

echo "=== Apply merchant column drift SQL ==="
dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  < "$ROOT/backend/sql/ensure-merchant-columns-drift.sql"

echo "=== Run full schema patches ==="
if dc run --rm migrate npx tsx src/db/run-schema-patches.ts 2>/dev/null; then
  echo "Schema patches applied via migrate container."
else
  echo "Migrate container patch step unavailable — will use API schema-repair after API starts."
fi

if [[ "${SKIP_API_STOP:-}" != "1" ]]; then
  echo "=== Start API ==="
  dc up -d api
  for _i in $(seq 1 30); do
    if dc exec -T api node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

echo "=== Schema repair via API ==="
repair_ok=0
for url in \
  "http://127.0.0.1:3000/api/health/schema-repair" \
  "https://app.rebornsense.com/api/health/schema-repair" \
  "http://127.0.0.1/api/health/schema-repair"; do
  if curl -sf -X POST "$url" >/dev/null 2>&1; then
    repair_ok=1
    echo "Schema repair OK via $url"
    break
  fi
done
if [[ "$repair_ok" != "1" ]]; then
  echo "ERROR: schema-repair endpoint did not succeed"
  exit 1
fi

after_attnum="$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.merchants'::regclass AND attnum > 0;" \
  | tr -d '[:space:]')"
after_rows="$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT count(*) FROM merchants;" | tr -d '[:space:]')"
missing_cols="$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='merchants';" \
  | tr -d '[:space:]')"

echo "After: pg_attribute=${after_attnum:-?} merchant_rows=${after_rows:-?} active_columns=${missing_cols:-?}"

if [[ "${after_rows:-0}" != "${before_rows:-0}" ]]; then
  echo "ERROR: merchant row count changed (${before_rows} -> ${after_rows})"
  exit 1
fi

if [[ "${after_attnum:-9999}" -gt 400 ]]; then
  echo "ERROR: merchants pg_attribute still high (${after_attnum})"
  exit 1
fi

echo "=== Done ==="
echo "Merchants table rebuilt. pg_attribute ${before_attnum:-?} -> ${after_attnum:-?}"
