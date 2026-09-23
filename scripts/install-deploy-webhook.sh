#!/usr/bin/env bash
# Install webhook-only deploy receiver on the RebornSense production VPS.
#
# Usage (on server as root, after repo is at /root/rebornSense):
#   bash /root/rebornSense/scripts/install-deploy-webhook.sh
#
# Then configure GitHub repo webhook (see DEPLOY.md § Webhook deploy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
ENV_FILE="${SECRETS_DIR}/deploy-webhook.env"
SERVICE_NAME="rebornsense-deploy-webhook"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
LOG_DIR="/var/log"
LOCK_FILE="/var/lock/rebornsense-deploy.lock"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root on the production server"
  exit 1
fi

mkdir -p "$SECRETS_DIR" "$LOG_DIR"
touch "${LOG_DIR}/rebornsense-deploy.log" "${LOG_DIR}/rebornsense-deploy-webhook.log"
chmod 600 "${LOG_DIR}/rebornsense-deploy.log" "${LOG_DIR}/rebornsense-deploy-webhook.log" 2>/dev/null || true
touch "$LOCK_FILE"

random_hex() {
  openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | xxd -p -c 48
}

if [[ ! -f "$ENV_FILE" ]]; then
  WEBHOOK_SECRET="$(random_hex)"
  WEBHOOK_TOKEN="$(random_hex)"
  cat >"$ENV_FILE" <<EOF
# RebornSense webhook deploy — generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOY_WEBHOOK_SECRET=${WEBHOOK_SECRET}
DEPLOY_WEBHOOK_TOKEN=${WEBHOOK_TOKEN}
DEPLOY_WEBHOOK_PORT=9847
DEPLOY_WEBHOOK_PATH=/internal/git-deploy
DEPLOY_WEBHOOK_HOST=127.0.0.1
DEPLOY_STACK=rebornsense
DEPLOY_PATH=${REPO_DIR}
DEPLOY_BRANCH=main
DEPLOY_ON_ANY_MAIN_PUSH=1
DEPLOY_LOG=${LOG_DIR}/rebornsense-deploy.log
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE"
else
  echo "Using existing $ENV_FILE"
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

chmod +x "$REPO_DIR/scripts/deploy-webhook-receiver.py"

cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=RebornSense git deploy webhook (webhook-only, no GitHub Actions)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${REPO_DIR}
ExecStart=/usr/bin/python3 ${REPO_DIR}/scripts/deploy-webhook-receiver.py
Restart=always
RestartSec=5
User=root
Group=root
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo ""
echo "=== Deploy webhook installed ==="
echo "Service: systemctl status ${SERVICE_NAME}"
echo "Logs:    tail -f ${LOG_DIR}/rebornsense-deploy-webhook.log"
echo "Deploy:  tail -f ${LOG_DIR}/rebornsense-deploy.log"
echo ""
echo "Webhook URL (configure in GitHub → Settings → Webhooks):"
echo "  https://app.rebornsense.com${DEPLOY_WEBHOOK_PATH}"
echo ""
echo "GitHub webhook secret (DEPLOY_WEBHOOK_SECRET):"
grep '^DEPLOY_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2-
echo ""
echo "Manual/agent trigger token (DEPLOY_WEBHOOK_TOKEN):"
grep '^DEPLOY_WEBHOOK_TOKEN=' "$ENV_FILE" | cut -d= -f2-
echo ""
echo "Test health:"
echo "  curl -fsS http://127.0.0.1:${DEPLOY_WEBHOOK_PORT}${DEPLOY_WEBHOOK_PATH}/health"
echo ""
echo "Test manual deploy:"
echo "  bash ${REPO_DIR}/scripts/trigger-production-deploy-webhook.sh"
echo ""
echo "IMPORTANT: Reload Caddy after deploy/Caddyfile.rebornsense includes /internal/git-deploy"
echo "  cd ${REPO_DIR} && docker compose --env-file ${SECRETS_DIR}/.env.production up -d caddy"
