#!/usr/bin/env bash
# Local demo login stack: Postgres + API (3000) + dashboard Vite dev server.
# Usage:
#   bash scripts/dev-local.sh          # bootstrap db, then start backend + dashboard
#   bash scripts/dev-local.sh db       # postgres + migrate + seed only
#   bash scripts/dev-local.sh serve    # start backend + dashboard (db must be ready)
#   bash scripts/dev-local.sh verify   # curl health + demo login
#   bash scripts/dev-local.sh stop     # stop background dev processes we started
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/dev-local-db.sh
source "$ROOT/scripts/lib/dev-local-db.sh"

PID_DIR="${TMPDIR:-/tmp}/reborn-dev-local"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
DASHBOARD_PID_FILE="$PID_DIR/dashboard.pid"
BACKEND_LOG="$PID_DIR/backend.log"
DASHBOARD_LOG="$PID_DIR/dashboard.log"
API_PORT="${API_PORT:-3000}"
DASHBOARD_PORT="${DASHBOARD_PORT:-5173}"

mkdir -p "$PID_DIR"

usage() {
  sed -n '2,8p' "$0" | sed 's/^# //'
}

is_reborn_backend() {
  curl -fsS "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null | grep -q '"service":"reborn-backend"'
}

port_listener_pid() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | head -1
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -E ":${port}\\b" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -1
  fi
}

ensure_backend_port_free() {
  local pid
  pid="$(port_listener_pid "$API_PORT" || true)"
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  if is_reborn_backend; then
    echo "Reborn backend already listening on port ${API_PORT}"
    return 0
  fi
  local cmd
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || echo unknown)"
  echo "Port ${API_PORT} is in use by PID ${pid}: ${cmd}" >&2
  echo "Stop that process before starting the API (wrong service causes login \"not found\")." >&2
  echo "  kill ${pid}" >&2
  return 1
}

start_backend() {
  ensure_backend_port_free
  if is_reborn_backend; then
    return 0
  fi
  echo "==> Starting backend on http://127.0.0.1:${API_PORT}"
  (
    cd "$ROOT/backend"
    export DATABASE_URL="$(dev_local_database_url)"
    nohup npm run dev >"$BACKEND_LOG" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
  for _ in $(seq 1 30); do
    if is_reborn_backend; then
      echo "    Backend ready"
      return 0
    fi
    sleep 1
  done
  echo "Backend failed to start — see $BACKEND_LOG" >&2
  tail -20 "$BACKEND_LOG" >&2 || true
  return 1
}

start_dashboard() {
  local pid
  pid="$(port_listener_pid "$DASHBOARD_PORT" || true)"
  if [[ -n "${pid:-}" ]]; then
    if ps -p "$pid" -o args= 2>/dev/null | grep -q vite; then
      echo "Dashboard Vite already listening on port ${DASHBOARD_PORT}"
      return 0
    fi
  fi
  echo "==> Starting dashboard Vite on http://127.0.0.1:${DASHBOARD_PORT}"
  (
    cd "$ROOT/dashboard"
    nohup npm run dev -- --host 127.0.0.1 --port "$DASHBOARD_PORT" >"$DASHBOARD_LOG" 2>&1 &
    echo $! >"$DASHBOARD_PID_FILE"
  )
  for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${DASHBOARD_PORT}/" >/dev/null 2>&1; then
      echo "    Dashboard ready"
      return 0
    fi
    sleep 1
  done
  echo "Dashboard failed to start — see $DASHBOARD_LOG" >&2
  tail -20 "$DASHBOARD_LOG" >&2 || true
  return 1
}

cmd_db() {
  bash "$ROOT/scripts/dev-local-install.sh"
  bash "$ROOT/scripts/dev-local-start.sh"
}

cmd_serve() {
  start_backend
  start_dashboard
  echo ""
  echo "Open:  http://127.0.0.1:${DASHBOARD_PORT}/login"
  echo "Demo:  demo@rebornsense.com / DemoShop123!"
  echo "Logs:  $BACKEND_LOG  $DASHBOARD_LOG"
}

cmd_verify() {
  echo "==> Health (direct API)"
  curl -fsS "http://127.0.0.1:${API_PORT}/api/health" | head -c 300
  echo ""
  echo ""
  echo "==> Demo login (direct API)"
  curl -fsS -X POST "http://127.0.0.1:${API_PORT}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"demo@rebornsense.com","password":"DemoShop123!"}' | head -c 400
  echo ""
  echo ""
  echo "==> Demo login (via Vite proxy /api)"
  curl -fsS -X POST "http://127.0.0.1:${DASHBOARD_PORT}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"demo@rebornsense.com","password":"DemoShop123!"}' | head -c 400
  echo ""
}

cmd_stop() {
  for f in "$BACKEND_PID_FILE" "$DASHBOARD_PID_FILE"; do
    if [[ -f "$f" ]]; then
      local pid
      pid="$(cat "$f")"
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "Stopped PID $pid"
      fi
      rm -f "$f"
    fi
  done
}

main() {
  local cmd="${1:-up}"
  case "$cmd" in
    -h|--help|help) usage; exit 0 ;;
    db) cmd_db ;;
    serve) cmd_serve ;;
    verify) cmd_verify ;;
    stop) cmd_stop ;;
    up|"")
      cmd_db
      cmd_serve
      cmd_verify
      ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
