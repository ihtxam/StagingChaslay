#!/usr/bin/env bash
# Configure SSH for Cloud Agents (staging + production Hetzner deploy hosts).
# Keys come from Cursor environment secrets — never commit them to git.
set -euo pipefail

SSH_DIR="${HOME}/.ssh"
CONFIG="${SSH_DIR}/config"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

write_key() {
  local env_name="$1"
  local out_path="$2"
  local val="${!env_name:-}"
  if [[ -z "$val" ]]; then
    return 1
  fi
  printf '%s\n' "$val" >"$out_path"
  chmod 600 "$out_path"
  return 0
}

append_host() {
  local alias="$1"
  local host="$2"
  local user="$3"
  local key_path="$4"
  local port="${5:-22}"
  cat >>"$CONFIG" <<EOF

Host ${alias}
  HostName ${host}
  User ${user}
  Port ${port}
  IdentityFile ${key_path}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
}

# Start fresh ssh config for our deploy hosts (preserve other entries if any).
if [[ -f "$CONFIG" ]]; then
  grep -v -E '^(Host|  )' "$CONFIG" >/dev/null 2>&1 || true
fi
: >"$CONFIG"
chmod 600 "$CONFIG"
printf '%s\n' '# Managed by scripts/cloud-agent-setup-ssh.sh' >>"$CONFIG"

STAGING_HOST="${STAGING_HETZNER_HOST:-116.202.26.15}"
STAGING_USER="${STAGING_HETZNER_USER:-root}"
STAGING_PORT="${STAGING_HETZNER_SSH_PORT:-22}"
STAGING_PATH="${STAGING_HETZNER_DEPLOY_PATH:-/root/StagingChaslay}"

PROD_HOST="${PRODUCTION_HETZNER_HOST:-91.98.41.165}"
PROD_USER="${PRODUCTION_HETZNER_USER:-root}"
PROD_PORT="${PRODUCTION_HETZNER_SSH_PORT:-22}"
PROD_PATH="${PRODUCTION_HETZNER_DEPLOY_PATH:-/root/rebornSense}"

staging_ok=false
prod_ok=false

if write_key STAGING_HETZNER_SSH_KEY "${SSH_DIR}/staging_hetzner"; then
  append_host staging-chaslay "$STAGING_HOST" "$STAGING_USER" "${SSH_DIR}/staging_hetzner" "$STAGING_PORT"
  staging_ok=true
  echo "SSH: staging-chaslay -> ${STAGING_USER}@${STAGING_HOST}:${STAGING_PORT}"
else
  echo "SSH: STAGING_HETZNER_SSH_KEY not set (staging direct deploy unavailable)"
fi

if write_key PRODUCTION_HETZNER_SSH_KEY "${SSH_DIR}/production_hetzner"; then
  append_host production-reborn "$PROD_HOST" "$PROD_USER" "${SSH_DIR}/production_hetzner" "$PROD_PORT"
  prod_ok=true
  echo "SSH: production-reborn -> ${PROD_USER}@${PROD_HOST}:${PROD_PORT}"
else
  echo "SSH: PRODUCTION_HETZNER_SSH_KEY not set (production direct deploy unavailable)"
fi

# Quick connectivity probe (non-fatal).
if $staging_ok; then
  if ssh -o BatchMode=yes -o ConnectTimeout=8 staging-chaslay "echo ok" >/dev/null 2>&1; then
    echo "SSH: staging-chaslay connection OK"
  else
    echo "SSH: staging-chaslay key present but connection failed (check authorized_keys)"
  fi
fi

if $prod_ok; then
  if ssh -o BatchMode=yes -o ConnectTimeout=8 production-reborn "echo ok" >/dev/null 2>&1; then
    echo "SSH: production-reborn connection OK"
  else
    echo "SSH: production-reborn key present but connection failed (check authorized_keys)"
  fi
fi

# Export paths for agent-deploy.sh
AGENT_ENV="${HOME}/.reborn-agent-env"
cat >"$AGENT_ENV" <<EOF
STAGING_SSH_ALIAS=staging-chaslay
STAGING_DEPLOY_PATH=${STAGING_PATH}
STAGING_DEPLOY_STACK=chaslay
PRODUCTION_SSH_ALIAS=production-reborn
PRODUCTION_DEPLOY_PATH=${PROD_PATH}
PRODUCTION_DEPLOY_STACK=rebornsense
EOF
chmod 600 "$AGENT_ENV"
