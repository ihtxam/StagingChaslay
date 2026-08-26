#!/usr/bin/env bash
# Restore a legacy pg_dump into the Rebornsense Postgres volume on 91.98.41.165.
# Intended for CI or manual use after dump was copied to the server.
#
# Usage (on Rebornsense VPS as root):
#   DUMP_FILE=/root/rebornsense-recovery-backups/legacy-manupos.dump \
#   CONFIRM=1 bash scripts/restore-rebornsense-dump.sh
#
# Optional env:
#   DEPLOY_PATH=/root/rebornSense
#   SKIP_UPLOADS=1
#   SKIP_MIGRATE=1
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/rebornSense}"
NEW_PROJECT="${NEW_COMPOSE_PROJECT:-rebornsense}"
ENV_FILE="${ENV_FILE:-$DEPLOY_PATH/.env.production}"
DUMP_FILE="${DUMP_FILE:-}"
OLD_UPLOADS_VOL="${OLD_UPLOADS_VOL:-foodtruckpos_uploads_data}"
NEW_UPLOADS_VOL="${NEW_UPLOADS_VOL:-rebornsense_uploads_data}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/rebornsense-recovery-backups}"
BACKUP_DIR="$BACKUP_ROOT/pre-restore-$(date +%Y%m%d-%H%M%S)"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

env_get() {
  local key="$1" file="$2" val
  [[ -f "$file" ]] || return 0
  val="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\''']//;s/["'\''']$//' || true)"
  printf '%s' "$val"
}

[[ -d "$DEPLOY_PATH" ]] || die "Deploy path missing: $DEPLOY_PATH"
[[ -f "$DEPLOY_PATH/docker-compose.yml" ]] || die "No docker-compose.yml in $DEPLOY_PATH"
[[ -f "$ENV_FILE" ]] || die "Missing env file: $ENV_FILE"
[[ -n "$DUMP_FILE" ]] || die "Set DUMP_FILE to the legacy pg_dump (.dump)"
[[ -f "$DUMP_FILE" ]] || die "Dump not found: $DUMP_FILE"
[[ -s "$DUMP_FILE" ]] || die "Dump file empty: $DUMP_FILE"
[[ "${CONFIRM:-}" == "1" ]] || die "Refusing to run without CONFIRM=1"

NEW_DB_USER="${NEW_DB_USER:-$(env_get POSTGRES_USER "$ENV_FILE")}"
NEW_DB_USER="${NEW_DB_USER:-manupos}"
NEW_DB_NAME="${NEW_DB_NAME:-$(env_get POSTGRES_DB "$ENV_FILE")}"
NEW_DB_NAME="${NEW_DB_NAME:-manupos}"

export_stack_caddyfile() {
  if [[ -f "$DEPLOY_PATH/deploy/Caddyfile.rebornsense" ]]; then
    export CADDYFILE="${CADDYFILE:-$DEPLOY_PATH/deploy/Caddyfile.rebornsense}"
  fi
}

dc() {
  export_stack_caddyfile
  docker compose -p "$NEW_PROJECT" --env-file "$ENV_FILE" "$@"
}

volume_exists() {
  docker volume inspect "$1" >/dev/null 2>&1
}

backup_volume() {
  local vol="$1" label="$2"
  if volume_exists "$vol"; then
    info "Backing up volume $vol ($label)"
    docker run --rm \
      -v "$vol:/data:ro" \
      -v "$BACKUP_DIR:/backup" \
      alpine:3.20 \
      sh -c "tar czf /backup/${label}.tar.gz -C /data ."
  fi
}

mkdir -p "$BACKUP_DIR"
info "Pre-restore backups -> $BACKUP_DIR"
backup_volume rebornsense_postgres_data rebornsense_postgres_pre
backup_volume "$NEW_UPLOADS_VOL" rebornsense_uploads_pre

cd "$DEPLOY_PATH"
info "Stopping api/dashboard/migrate (db stays up)"
dc stop api dashboard migrate 2>/dev/null || true

info "Ensuring db is running"
dc up -d db
for i in $(seq 1 30); do
  if dc exec -T db pg_isready -U "$NEW_DB_USER" -d "$NEW_DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

info "Restoring dump: $DUMP_FILE"
cat "$DUMP_FILE" | dc exec -T db pg_restore \
  -U "$NEW_DB_USER" -d "$NEW_DB_NAME" \
  --clean --if-exists --no-owner --no-acl \
  || echo "pg_restore reported errors (often safe); continuing..."

info "Post-restore counts:"
dc exec -T db psql -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -c \
  "SELECT 'merchants' AS tbl, count(*) FROM merchants UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders UNION ALL SELECT 'superadmins', count(*) FROM superadmins;" \
  || true

if [[ "${SKIP_UPLOADS:-}" != "1" ]] && volume_exists "$OLD_UPLOADS_VOL"; then
  info "Merging uploads $OLD_UPLOADS_VOL -> $NEW_UPLOADS_VOL"
  docker volume create "$NEW_UPLOADS_VOL" >/dev/null 2>&1 || true
  backup_volume "$OLD_UPLOADS_VOL" legacy_uploads_snapshot
  docker run --rm \
    -v "$OLD_UPLOADS_VOL:/from:ro" \
    -v "$NEW_UPLOADS_VOL:/to" \
    alpine:3.20 \
    sh -c 'mkdir -p /to && cp -an /from/. /to/ 2>/dev/null || cp -a /from/. /to/'
else
  info "Uploads merge skipped (SKIP_UPLOADS=1 or no $OLD_UPLOADS_VOL)"
fi

if [[ "${SKIP_MIGRATE:-}" != "1" ]]; then
  info "Running migrations"
  dc run --rm migrate 2>/dev/null || dc run --rm migrate || true
fi

info "Starting full stack"
export DEPLOY_STACK=rebornsense
dc up -d

info "Restore complete."
info "  Backups: $BACKUP_DIR"
info "  Dump:    $DUMP_FILE"
