#!/usr/bin/env bash
# One-time / recovery fix for app.rebornsense.com on Hetzner (91.98.41.165).
# Run on the server as root:
#   curl -fsSL https://raw.githubusercontent.com/ihtxam/FoodTruckPOS/main/scripts/fix-rebornsense-server.sh | bash
# Or after git pull:
#   bash /root/FoodTruckPOS/scripts/fix-rebornsense-server.sh
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-/root/FoodTruckPOS}"
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
ENV_FILE="$SECRETS_DIR/.env.production"

echo "=== Rebornsense production fix @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="

mkdir -p "$SECRETS_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$REPO_DIR/.env.production.example" "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"
fi

set_kv() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

set_kv DOMAIN rebornsense.com
set_kv PUBLIC_APP_URL https://app.rebornsense.com
set_kv PUBLIC_RECEIPT_BASE_URL https://pay.rebornsense.com
set_kv CADDYFILE Caddyfile.rebornsense
grep -qE '^ACME_EMAIL=' "$ENV_FILE" || set_kv ACME_EMAIL admin@rebornsense.com

ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

echo "=== Firewall (UFW) — allow web ==="
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
  ufw status || true
fi

echo "=== Stop legacy backend compose if present ==="
if [[ -f "$REPO_DIR/backend/docker-compose.yml" ]]; then
  (cd "$REPO_DIR/backend" && docker compose down || true)
fi

cd "$REPO_DIR"
echo "=== Deploy stack ==="
bash "$REPO_DIR/scripts/deploy-hetzner.sh"

echo "=== Local checks ==="
curl -sf http://127.0.0.1/ -o /dev/null -w "localhost:80 HTTP %{http_code}\n" || true
curl -sf http://127.0.0.1:3000/health || true
docker compose --env-file .env.production ps

echo "=== Done. Verify: https://app.rebornsense.com/ ==="
echo "If HTTPS still fails from outside, open ports 80+443 in Hetzner Cloud Firewall for this server."
