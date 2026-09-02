#!/usr/bin/env bash
# First-time or repair bootstrap for Chaslay staging VPS (116.202.26.15).
# Clones the private StagingChaslay repo via SSH deploy key, then runs deploy.
#
# Usage (on the server as root):
#   bash /root/StagingChaslay/scripts/setup-staging-chaslay-server.sh
#
# Environment overrides:
#   DEPLOY_PATH=/root/StagingChaslay
#   REPO_URL=git@github.com-staging-chaslay:ihtxam/StagingChaslay.git
#   DEPLOY_KEY=/root/.ssh/staging_chaslay_deploy
#   STAGING_GITHUB_SSH_HOST=github.com-staging-chaslay
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/StagingChaslay}"
DEPLOY_KEY="${DEPLOY_KEY:-/root/.ssh/staging_chaslay_deploy}"
STAGING_GITHUB_SSH_HOST="${STAGING_GITHUB_SSH_HOST:-github.com-staging-chaslay}"
REPO_URL="${REPO_URL:-git@${STAGING_GITHUB_SSH_HOST}:ihtxam/StagingChaslay.git}"
export DEPLOY_STACK=chaslay
export DEPLOY_PATH

echo "=== StagingChaslay server bootstrap @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
echo "  DEPLOY_PATH=$DEPLOY_PATH"
echo "  REPO_URL=$REPO_URL"
echo "  DEPLOY_KEY=$DEPLOY_KEY"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (ssh root@116.202.26.15)"
  exit 1
fi

apt-get update
apt-get install -y git docker.io docker-compose-plugin curl openssh-client
systemctl enable --now docker

mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [[ ! -f "$DEPLOY_KEY" ]]; then
  echo ""
  echo "=== Generating GitHub deploy key ==="
  ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -N '' -C 'staging-chaslay-vps-deploy'
  echo ""
  echo "=== ADD THIS PUBLIC KEY TO GITHUB (Deploy keys, read-only) ==="
  echo "  https://github.com/ihtxam/StagingChaslay/settings/keys"
  echo ""
  cat "${DEPLOY_KEY}.pub"
  echo ""
  echo "After adding the key on GitHub, re-run this script."
  exit 0
fi

chmod 600 "$DEPLOY_KEY"
SSH_CONFIG=/root/.ssh/config
if ! grep -qE "^Host ${STAGING_GITHUB_SSH_HOST}$" "$SSH_CONFIG" 2>/dev/null; then
  cat >>"$SSH_CONFIG" <<EOF

Host ${STAGING_GITHUB_SSH_HOST}
  HostName github.com
  User git
  IdentityFile ${DEPLOY_KEY}
  IdentitiesOnly yes
EOF
  chmod 600 "$SSH_CONFIG"
fi

echo "=== Test GitHub SSH (${STAGING_GITHUB_SSH_HOST}) ==="
if ! ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T "git@${STAGING_GITHUB_SSH_HOST}" 2>&1 | grep -qi 'successfully authenticated'; then
  echo "ERROR: Cannot authenticate to GitHub with $DEPLOY_KEY"
  echo ""
  echo "If you just generated the key, add the public key to GitHub:"
  echo "  https://github.com/ihtxam/StagingChaslay/settings/keys"
  echo ""
  cat "${DEPLOY_KEY}.pub"
  exit 1
fi

if [[ ! -d "$DEPLOY_PATH/.git" ]]; then
  rm -rf "$DEPLOY_PATH"
  git clone "$REPO_URL" "$DEPLOY_PATH"
else
  cd "$DEPLOY_PATH"
  git remote set-url origin "$REPO_URL"
  git fetch origin main
  git reset --hard origin/main
fi

cd "$DEPLOY_PATH"
chmod +x scripts/deploy-hetzner.sh
export DEPLOY_PATH
bash scripts/deploy-hetzner.sh
