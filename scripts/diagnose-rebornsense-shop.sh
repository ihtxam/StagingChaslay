#!/usr/bin/env bash
# Diagnose "Shop not found or closed" on Rebornsense production.
# Run on the server: bash /root/rebornSense/scripts/diagnose-rebornsense-shop.sh
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-/root/rebornSense}"
cd "$REPO_DIR"

dc() {
  docker compose --env-file .env.production "$@"
}

echo "=== Rebornsense shop diagnostic @ $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo

echo "--- Docker stack ---"
dc ps
echo

echo "--- Merchant count ---"
dc exec -T db psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" -c \
  "SELECT count(*) AS merchants FROM merchants;"
echo

echo "--- Merchants (slug, subdomain, shop_enabled, status) ---"
dc exec -T db psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" -c \
  "SELECT id, name, email, slug, subdomain, shop_enabled, status FROM merchants ORDER BY created_at LIMIT 20;"
echo

echo "--- Superadmin count ---"
dc exec -T db psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" -c \
  "SELECT count(*) AS superadmins FROM superadmins;"
echo

echo "--- API health ---"
curl -sf http://127.0.0.1:3000/health 2>/dev/null || dc exec -T api wget -qO- http://127.0.0.1:3000/health || echo "API unreachable"
echo

echo
echo "Panel login (staff / owner):  https://app.rebornsense.com/login"
echo "Online shop needs shop_enabled=true and a valid slug/subdomain."
echo
echo "To enable all shops (after verifying merchants look correct):"
echo "  dc exec -T db psql -U manupos -d manupos -c \"UPDATE merchants SET shop_enabled = true WHERE status = 'active';\""
