#!/usr/bin/env bash
# Reset StagingChaslay Postgres when merchants table hits the 1600-column limit.
# WARNING: deletes all staging data (merchants, orders, demo shop).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEPLOY_STACK="${DEPLOY_STACK:-chaslay}"
PROJECT="$(basename "$ROOT" | tr '[:upper:]' '[:lower:]')"
VOLUME="${PROJECT}_postgres_data"

echo "Stopping stack and removing volume ${VOLUME}..."
docker compose stop api dashboard migrate 2>/dev/null || true
docker compose down 2>/dev/null || true
docker volume rm "$VOLUME" 2>/dev/null || true

echo "Starting fresh database..."
docker compose up -d db
for _i in $(seq 1 60); do
  docker compose exec -T db pg_isready -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" >/dev/null 2>&1 && break
  sleep 2
done

echo "Running migrate + seed..."
docker compose run --rm migrate

echo "Starting app..."
docker compose up -d --build api dashboard caddy

echo "Done. Demo login: demo@rebornsense.com / DemoShop123!"
