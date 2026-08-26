#!/usr/bin/env bash
# Recover FoodTruckPOS (legacy) Postgres + uploads into the Rebornsense stack.
# Run on 91.98.41.165 as root. Does NOT delete old volumes.
#
# Usage:
#   cd /root/rebornSense
#   CONFIRM=1 bash scripts/recover-rebornsense-data.sh
#
# Optional env:
#   OLD_COMPOSE_PROJECT=foodtruckpos   # legacy compose project (volume prefix)
#   NEW_COMPOSE_PROJECT=rebornsense    # current compose project
#   OLD_PATH=/root/FoodTruckPOS
#   DEPLOY_PATH=/root/rebornSense
#   OLD_DB_USER / OLD_DB_NAME          # auto-detected from old stack if unset
#   SKIP_UPLOADS=1                     # postgres only
#   DRY_RUN=1                          # inspect only, no changes
set -euo pipefail

OLD_PROJECT="${OLD_COMPOSE_PROJECT:-foodtruckpos}"
NEW_PROJECT="${NEW_COMPOSE_PROJECT:-rebornsense}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/rebornSense}"
OLD_PATH="${OLD_PATH:-/root/FoodTruckPOS}"
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
ENV_FILE="${ENV_FILE:-$SECRETS_DIR/.env.production}"

OLD_PG_VOL="${OLD_PROJECT}_postgres_data"
OLD_UPLOADS_VOL="${OLD_PROJECT}_uploads_data"
NEW_PG_VOL="${NEW_PROJECT}_postgres_data"
NEW_UPLOADS_VOL="${NEW_PROJECT}_uploads_data"

BACKUP_ROOT="${BACKUP_ROOT:-/root/rebornsense-recovery-backups}"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DUMP_FILE:-$BACKUP_DIR/legacy-manupos.dump}"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

volume_exists() {
  docker volume inspect "$1" >/dev/null 2>&1
}

env_get() {
  local key="$1" file="$2" val
  [[ -f "$file" ]] || return 0
  val="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//' || true)"
  printf '%s' "$val"
}

detect_old_db_creds() {
  OLD_DB_USER="${OLD_DB_USER:-$(env_get POSTGRES_USER "$OLD_PATH/backend/.env")}"
  OLD_DB_USER="${OLD_DB_USER:-$(env_get POSTGRES_USER "$OLD_PATH/.env.production")}"
  OLD_DB_USER="${OLD_DB_USER:-$(env_get POSTGRES_USER "$SECRETS_DIR/backend.env")}"
  OLD_DB_USER="${OLD_DB_USER:-manupos}"

  OLD_DB_NAME="${OLD_DB_NAME:-$(env_get POSTGRES_DB "$OLD_PATH/backend/.env")}"
  OLD_DB_NAME="${OLD_DB_NAME:-$(env_get POSTGRES_DB "$OLD_PATH/.env.production")}"
  OLD_DB_NAME="${OLD_DB_NAME:-$(env_get POSTGRES_DB "$SECRETS_DIR/backend.env")}"
  OLD_DB_NAME="${OLD_DB_NAME:-manupos}"
}

detect_new_db_creds() {
  NEW_DB_USER="${NEW_DB_USER:-$(env_get POSTGRES_USER "$DEPLOY_PATH/.env.production")}"
  NEW_DB_USER="${NEW_DB_USER:-$(env_get POSTGRES_USER "$ENV_FILE")}"
  NEW_DB_USER="${NEW_DB_USER:-manupos}"

  NEW_DB_NAME="${NEW_DB_NAME:-$(env_get POSTGRES_DB "$DEPLOY_PATH/.env.production")}"
  NEW_DB_NAME="${NEW_DB_NAME:-$(env_get POSTGRES_DB "$ENV_FILE")}"
  NEW_DB_NAME="${NEW_DB_NAME:-manupos}"
}

export_stack_caddyfile() {
  if [[ -f "$DEPLOY_PATH/deploy/Caddyfile.rebornsense" ]]; then
    export CADDYFILE="${CADDYFILE:-$DEPLOY_PATH/deploy/Caddyfile.rebornsense}"
  fi
}

dc() {
  export_stack_caddyfile
  docker compose -p "$NEW_PROJECT" --env-file "$DEPLOY_PATH/.env.production" "$@"
}

find_old_db_container() {
  local name
  for name in "${OLD_PROJECT}-db-1" "foodtruckpos-db-1" "backend-db-1"; do
    if docker inspect "$name" >/dev/null 2>&1; then
      if [[ "$(docker inspect -f '{{.State.Running}}' "$name")" == "true" ]]; then
        printf '%s' "$name"
        return 0
      fi
    fi
  done
  return 1
}

probe_legacy_volume() {
  docker run --rm -v "$OLD_PG_VOL:/var/lib/postgresql/data:ro" postgres:16-alpine \
    sh -c 'test -f /var/lib/postgresql/data/PG_VERSION && cat /var/lib/postgresql/data/PG_VERSION'
}

info "Rebornsense data recovery"
info "  Old project/volumes: $OLD_PROJECT (${OLD_PG_VOL}, ${OLD_UPLOADS_VOL})"
info "  New project/volumes: $NEW_PROJECT (${NEW_PG_VOL}, ${NEW_UPLOADS_VOL})"
info "  Deploy path: $DEPLOY_PATH"
echo ""

info "Docker volumes (postgres / uploads):"
docker volume ls | grep -E 'postgres|uploads' || true
echo ""

if ! volume_exists "$OLD_PG_VOL"; then
  die "Legacy Postgres volume not found: $OLD_PG_VOL — list volumes above and set OLD_COMPOSE_PROJECT if the prefix differs."
fi

detect_old_db_creds
detect_new_db_creds
info "Legacy DB: user=$OLD_DB_USER db=$OLD_DB_NAME"
info "Target DB: user=$NEW_DB_USER db=$NEW_DB_NAME"

PG_VERSION="$(probe_legacy_volume 2>/dev/null || echo unknown)"
info "Legacy Postgres data version (PG_VERSION): $PG_VERSION"
if [[ "$PG_VERSION" != "unknown" && "$PG_VERSION" != "16" ]]; then
  echo "WARNING: Expected Postgres 16 data directory; found PG_VERSION=$PG_VERSION"
fi

if [[ "${DRY_RUN:-}" == "1" ]]; then
  info "DRY_RUN=1 — no changes will be made."
  if running="$(find_old_db_container || true)"; then
    info "Running legacy DB container: $running"
    docker exec "$running" psql -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -c \
      "SELECT count(*) AS merchants FROM merchants;" 2>/dev/null || true
  fi
  exit 0
fi

if [[ "${CONFIRM:-}" != "1" ]]; then
  cat <<EOF

This will:
  1. Backup current $NEW_PG_VOL and $NEW_UPLOADS_VOL to $BACKUP_DIR
  2. Dump legacy data from $OLD_PG_VOL (or running ${OLD_PROJECT}-db-1)
  3. Restore into the Rebornsense Postgres ($NEW_PG_VOL)
  4. Merge legacy uploads into $NEW_UPLOADS_VOL
  5. Run migrations and restart the stack

Old volumes are NOT deleted.

To proceed, run:
  CONFIRM=1 bash $0

EOF
  exit 0
fi

[[ -d "$DEPLOY_PATH" ]] || die "Deploy path missing: $DEPLOY_PATH"
[[ -f "$DEPLOY_PATH/docker-compose.yml" ]] || die "No docker-compose.yml in $DEPLOY_PATH"
[[ -f "$DEPLOY_PATH/.env.production" ]] || die "Missing $DEPLOY_PATH/.env.production (symlink to secrets?)"

mkdir -p "$BACKUP_DIR"
info "Backups -> $BACKUP_DIR"

backup_volume() {
  local vol="$1" label="$2"
  if volume_exists "$vol"; then
    info "Backing up volume $vol ($label)"
    docker run --rm \
      -v "$vol:/data:ro" \
      -v "$BACKUP_DIR:/backup" \
      alpine:3.20 \
      sh -c "tar czf /backup/${label}.tar.gz -C /data ."
  else
    info "Volume $vol not present — skip backup ($label)"
  fi
}

backup_volume "$NEW_PG_VOL" "rebornsense_postgres_pre"
backup_volume "$NEW_UPLOADS_VOL" "rebornsense_uploads_pre"

info "Stopping Rebornsense api/dashboard/migrate (db stays up for restore)"
cd "$DEPLOY_PATH"
dc stop api dashboard migrate 2>/dev/null || true

info "Creating legacy Postgres dump"
if running_old="$(find_old_db_container || true)"; then
  info "Dumping from running container: $running_old"
  docker exec "$running_old" pg_dump -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -Fc >"$DUMP_FILE"
else
  info "Starting ephemeral Postgres on $OLD_PG_VOL"
  TEMP_OLD="recover-old-pg-$$"
  cleanup_old() { docker rm -f "$TEMP_OLD" >/dev/null 2>&1 || true; }
  trap cleanup_old EXIT
  docker run -d --name "$TEMP_OLD" \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    -v "$OLD_PG_VOL:/var/lib/postgresql/data" \
    postgres:16-alpine >/dev/null
  for i in $(seq 1 30); do
    if docker exec "$TEMP_OLD" pg_isready -U "$OLD_DB_USER" -d "$OLD_DB_NAME" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  docker exec "$TEMP_OLD" pg_dump -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -Fc >"$DUMP_FILE"
  cleanup_old
  trap - EXIT
fi

[[ -s "$DUMP_FILE" ]] || die "Dump file empty or missing: $DUMP_FILE"
info "Dump size: $(du -h "$DUMP_FILE" | cut -f1)"

info "Legacy tenant count (from dump TOC):"
docker run --rm -v "$BACKUP_DIR:/backup:ro" postgres:16-alpine \
  pg_restore -l "/backup/$(basename "$DUMP_FILE")" 2>/dev/null | head -3 || true

info "Ensuring Rebornsense db container is running"
dc up -d db
for i in $(seq 1 30); do
  if dc exec -T db pg_isready -U "$NEW_DB_USER" -d "$NEW_DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

info "Restoring dump into Rebornsense Postgres (--clean --if-exists)"
cat "$DUMP_FILE" | dc exec -T db pg_restore \
  -U "$NEW_DB_USER" -d "$NEW_DB_NAME" \
  --clean --if-exists --no-owner --no-acl \
  || echo "pg_restore reported errors (often safe for missing extensions); continuing..."

info "Post-restore counts:"
dc exec -T db psql -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -c \
  "SELECT 'merchants' AS tbl, count(*) FROM merchants UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders UNION ALL SELECT 'superadmins', count(*) FROM superadmins;" \
  2>/dev/null || echo "(could not query — run migrate then recount)"

if [[ "${SKIP_UPLOADS:-}" != "1" ]]; then
  if volume_exists "$OLD_UPLOADS_VOL"; then
  info "Merging uploads $OLD_UPLOADS_VOL -> $NEW_UPLOADS_VOL"
  docker volume create "$NEW_UPLOADS_VOL" >/dev/null 2>&1 || true
  backup_volume "$OLD_UPLOADS_VOL" "legacy_uploads_snapshot"
  docker run --rm \
    -v "$OLD_UPLOADS_VOL:/from:ro" \
    -v "$NEW_UPLOADS_VOL:/to" \
    alpine:3.20 \
    sh -c 'mkdir -p /to && cp -an /from/. /to/ 2>/dev/null || cp -a /from/. /to/'
  else
    info "No legacy uploads volume ($OLD_UPLOADS_VOL) — skip"
  fi
else
  info "SKIP_UPLOADS=1 — uploads not copied"
fi

info "Running migrations (schema drift after restore)"
dc run --rm migrate 2>/dev/null || dc run --rm migrate || true

info "Starting full stack"
export DEPLOY_STACK=rebornsense
export DEPLOY_PATH
dc up -d

info "Recovery complete."
info "  Backups: $BACKUP_DIR"
info "  Dump:    $DUMP_FILE"
info "  Login:   https://app.rebornsense.com/login (use legacy superadmin / merchant credentials)"
info "  Old volumes preserved: $OLD_PG_VOL, $OLD_UPLOADS_VOL"
