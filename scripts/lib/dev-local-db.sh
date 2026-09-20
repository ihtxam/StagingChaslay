#!/usr/bin/env bash
# Shared helpers for local Postgres (Docker or native).
set -euo pipefail

DEV_LOCAL_DB_USER="${POSTGRES_USER:-manupos}"
DEV_LOCAL_DB_NAME="${POSTGRES_DB:-manupos}"
DEV_LOCAL_DB_PASSWORD="${POSTGRES_PASSWORD:-localdev}"
DEV_LOCAL_DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DEV_LOCAL_DB_PORT="${POSTGRES_PORT:-5432}"

dev_local_database_url() {
  printf 'postgresql://%s:%s@%s:%s/%s' \
    "$DEV_LOCAL_DB_USER" "$DEV_LOCAL_DB_PASSWORD" "$DEV_LOCAL_DB_HOST" "$DEV_LOCAL_DB_PORT" "$DEV_LOCAL_DB_NAME"
}

dev_local_wait_for_postgres() {
  local tries="${1:-40}"
  for _ in $(seq 1 "$tries"); do
    if command -v pg_isready >/dev/null 2>&1; then
      if pg_isready -h "$DEV_LOCAL_DB_HOST" -p "$DEV_LOCAL_DB_PORT" -U "$DEV_LOCAL_DB_USER" -d "$DEV_LOCAL_DB_NAME" >/dev/null 2>&1; then
        return 0
      fi
      if pg_isready -h "$DEV_LOCAL_DB_HOST" -p "$DEV_LOCAL_DB_PORT" >/dev/null 2>&1; then
        return 0
      fi
    fi
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      if docker compose -f docker-compose.dev.yml ps db 2>/dev/null | grep -qE 'healthy|running'; then
        sleep 1
        continue
      fi
    fi
    sleep 1
  done
  echo "Postgres did not become ready on ${DEV_LOCAL_DB_HOST}:${DEV_LOCAL_DB_PORT}" >&2
  return 1
}

dev_local_ensure_native_postgres() {
  if ! command -v psql >/dev/null 2>&1; then
    return 1
  fi
  if ! pg_isready -h "$DEV_LOCAL_DB_HOST" -p "$DEV_LOCAL_DB_PORT" >/dev/null 2>&1; then
    if command -v pg_ctlcluster >/dev/null 2>&1; then
      sudo pg_ctlcluster 16 main start >/dev/null 2>&1 || true
    fi
  fi
  if ! pg_isready -h "$DEV_LOCAL_DB_HOST" -p "$DEV_LOCAL_DB_PORT" >/dev/null 2>&1; then
    return 1
  fi
  sudo -u postgres psql -v ON_ERROR_STOP=0 -c \
    "DO \$\$ BEGIN CREATE USER ${DEV_LOCAL_DB_USER} WITH PASSWORD '${DEV_LOCAL_DB_PASSWORD}'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" >/dev/null 2>&1 || true
  sudo -u postgres psql -v ON_ERROR_STOP=0 -c \
    "SELECT 1 FROM pg_database WHERE datname='${DEV_LOCAL_DB_NAME}'" | grep -q 1 || \
    sudo -u postgres createdb -O "$DEV_LOCAL_DB_USER" "$DEV_LOCAL_DB_NAME" >/dev/null 2>&1 || true
  return 0
}

dev_local_start_postgres() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if ! pg_isready -h "$DEV_LOCAL_DB_HOST" -p "$DEV_LOCAL_DB_PORT" >/dev/null 2>&1; then
      echo "Starting Postgres via docker compose (docker-compose.dev.yml)..."
      docker compose -f docker-compose.dev.yml up -d db
    else
      echo "Postgres already listening on ${DEV_LOCAL_DB_HOST}:${DEV_LOCAL_DB_PORT} (docker)"
    fi
    dev_local_wait_for_postgres
    return 0
  fi

  echo "Docker unavailable — using native Postgres..."
  if dev_local_ensure_native_postgres; then
    dev_local_wait_for_postgres
    return 0
  fi

  cat >&2 <<'EOF'
Could not start Postgres. Install one of:
  • Docker Desktop + run: docker compose -f docker-compose.dev.yml up -d db
  • PostgreSQL 16 locally (macOS: brew install postgresql@16; Linux: apt install postgresql)
EOF
  return 1
}

dev_local_migrate_and_seed() {
  local root="$1"
  cd "$root/backend"
  export DATABASE_URL
  DATABASE_URL="$(dev_local_database_url)"

  echo "==> Pushing schema (drizzle-kit push)"
  npx drizzle-kit push --force

  echo "==> Running schema patches"
  npx tsx src/db/run-schema-patches.ts || true

  echo "==> Seeding demo accounts"
  npx tsx src/db/seed.ts
}
