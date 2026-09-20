#!/usr/bin/env bash
# Per-boot startup for Cursor Desktop / cloud agents — Postgres + schema + seed (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/dev-local-db.sh
source "$ROOT/scripts/lib/dev-local-db.sh"

if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
fi

# Keep DATABASE_URL in sync with whichever Postgres backend we started.
export DATABASE_URL="$(dev_local_database_url)"
if grep -q '^DATABASE_URL=' backend/.env; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" backend/.env
else
  echo "DATABASE_URL=${DATABASE_URL}" >> backend/.env
fi

dev_local_start_postgres
dev_local_migrate_and_seed "$ROOT"

echo "==> Local demo DB ready ($(dev_local_database_url))"
