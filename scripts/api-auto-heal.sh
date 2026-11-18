#!/usr/bin/env bash
# Opt-in API auto-heal: after N consecutive failed health probes, restart API (+ Caddy if needed).
# Safe defaults: 3 failures, 1 hour between heal actions (avoids restart loops on bad deploys).
#
# Usage (on Hetzner host, from repo root or with absolute path):
#   HEALTH_URL="https://app.rebornsense.com/api/health?deep=1" \
#   DEPLOY_PATH=/root/rebornSense DEPLOY_STACK=rebornsense \
#   bash scripts/api-auto-heal.sh
#
# Cron example (every 5 minutes):
#   */5 * * * * HEALTH_URL='https://app.rebornsense.com/api/health?deep=1' DEPLOY_PATH=/root/rebornSense DEPLOY_STACK=rebornsense /root/rebornSense/scripts/api-auto-heal.sh >>/var/log/reborn-api-auto-heal.log 2>&1
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-https://app.rebornsense.com/api/health?deep=1}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/rebornSense}"
DEPLOY_STACK="${DEPLOY_STACK:-rebornsense}"
MAX_FAILURES="${MAX_FAILURES:-3}"
COOLDOWN_SEC="${COOLDOWN_SEC:-3600}"
STATE_DIR="${STATE_DIR:-/root/.reborn-api-auto-heal/${DEPLOY_STACK}}"
ENV_FILE="${ENV_FILE:-}"

mkdir -p "$STATE_DIR"
FAIL_FILE="$STATE_DIR/fail_count"
LAST_HEAL_FILE="$STATE_DIR/last_heal_epoch"
LOG_PREFIX="[api-auto-heal ${DEPLOY_STACK}]"

now_epoch() { date +%s; }

read_fail_count() {
  if [[ -f "$FAIL_FILE" ]]; then
    tr -dc '0-9' <"$FAIL_FILE" | head -c 8 || echo 0
  else
    echo 0
  fi
}

probe_ok() {
  local code body
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' --max-time 45 "$HEALTH_URL" 2>/dev/null || echo "000")"
  if [[ "$code" != "200" ]]; then
    echo "$LOG_PREFIX probe HTTP $code (url=$HEALTH_URL)" >&2
    rm -f "$body"
    return 1
  fi
  if grep -q '"database"' "$body" 2>/dev/null; then
    if ! grep -q '"database"[[:space:]]*:[[:space:]]*"ok"' "$body" 2>/dev/null; then
      echo "$LOG_PREFIX probe database not ok" >&2
      cat "$body" >&2 || true
      rm -f "$body"
      return 1
    fi
  fi
  rm -f "$body"
  return 0
}

restart_stack() {
  echo "$LOG_PREFIX restarting API stack in $DEPLOY_PATH @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cd "$DEPLOY_PATH"
  if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
    export ENV_FILE
  elif [[ -f /root/rebornsense-secrets/.env.production ]]; then
    export ENV_FILE=/root/rebornsense-secrets/.env.production
  elif [[ -f /root/chaslay-secrets/.env.production ]]; then
    export ENV_FILE=/root/chaslay-secrets/.env.production
  fi
  if [[ -f "$DEPLOY_PATH/.env.production" ]]; then
    # shellcheck disable=SC1091
    set -a
    source "$DEPLOY_PATH/.env.production" 2>/dev/null || true
    set +a
  fi
  dc() {
    docker compose --env-file "${ENV_FILE:-$DEPLOY_PATH/.env.production}" "$@"
  }
  docker ps -aq --filter "name=${DEPLOY_STACK}-api" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
  dc up -d db 2>/dev/null || true
  sleep 5
  # During venue service hours, only bounce API + Caddy (avoid dashboard/POS shell recycle).
  # shellcheck disable=SC1091
  source "$(dirname "$0")/production-service-hours.sh" 2>/dev/null || true
  if declare -F production_service_hours_active >/dev/null 2>&1 && production_service_hours_active; then
    dc up -d --force-recreate api caddy 2>/dev/null || dc up -d api caddy 2>/dev/null || true
  else
    dc up -d --force-recreate api dashboard caddy 2>/dev/null || dc up -d api caddy 2>/dev/null || true
  fi
  sleep 20
  if probe_ok; then
    echo "$LOG_PREFIX restart recovered health"
    return 0
  fi
  echo "$LOG_PREFIX WARNING: health still failing after restart" >&2
  return 1
}

if probe_ok; then
  echo 0 >"$FAIL_FILE"
  echo "$LOG_PREFIX OK $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

count="$(read_fail_count)"
count=$((count + 1))
echo "$count" >"$FAIL_FILE"
echo "$LOG_PREFIX failure $count/$MAX_FAILURES $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$count" -lt "$MAX_FAILURES" ]]; then
  exit 0
fi

last_heal=0
if [[ -f "$LAST_HEAL_FILE" ]]; then
  last_heal="$(tr -dc '0-9' <"$LAST_HEAL_FILE" | head -c 12 || echo 0)"
fi
now="$(now_epoch)"
if [[ "$((now - last_heal))" -lt "$COOLDOWN_SEC" ]]; then
  echo "$LOG_PREFIX heal skipped (cooldown ${COOLDOWN_SEC}s, last=$last_heal)" >&2
  exit 0
fi

if restart_stack; then
  echo 0 >"$FAIL_FILE"
  echo "$now" >"$LAST_HEAL_FILE"
  exit 0
fi

echo "$now" >"$LAST_HEAL_FILE"
exit 1
