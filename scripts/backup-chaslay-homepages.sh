#!/usr/bin/env bash
# Dump Chaslay homepage builder tables before destructive staging resets.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${CHASLAY_BACKUP_DIR:-$ROOT/.chaslay-backups}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_FILE="${BACKUP_DIR}/chaslay-homepages-${STAMP}.sql"

mkdir -p "$BACKUP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not available — skipping chaslay homepage backup"
  exit 0
fi

if ! docker compose ps db >/dev/null 2>&1; then
  echo "db service not running — skipping chaslay homepage backup"
  exit 0
fi

POSTGRES_USER="${POSTGRES_USER:-manupos}"
POSTGRES_DB="${POSTGRES_DB:-manupos}"

echo "Backing up chaslay homepage tables to ${OUT_FILE}"
docker compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --data-only \
  --table=public.chaslay_homepage_builders \
  --table=public.chaslay_homepage_builder_pages \
  >"$OUT_FILE"

echo "Chaslay homepage backup saved (${OUT_FILE})"
