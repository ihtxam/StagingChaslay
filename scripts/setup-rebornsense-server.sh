#!/usr/bin/env bash
# First-time or repair bootstrap for Rebornsense VPS (91.98.41.165).
# Clones the private rebornSense repo via SSH deploy key, then runs deploy.
#
# Usage (on the server as root):
#   curl -fsSL https://raw.githubusercontent.com/ihtxam/rebornSense/main/scripts/setup-rebornsense-server.sh | bash
#   # or after you have the repo:
#   bash /root/rebornSense/scripts/setup-rebornsense-server.sh
#
# Environment overrides:
#   DEPLOY_PATH=/root/rebornSense     target clone path (default)
#   LEGACY_PATH=/root/FoodTruckPOS    re-init git here instead of cloning (optional)
#   REPO_URL=git@github.com:ihtxam/rebornSense.git
#   DEPLOY_KEY=/root/.ssh/rebornsense_deploy
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:ihtxam/rebornSense.git}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/rebornSense}"
LEGACY_PATH="${LEGACY_PATH:-}"
DEPLOY_KEY="${DEPLOY_KEY:-/root/.ssh/rebornsense_deploy}"
DEPLOY_STACK=rebornsense

echo "=== Rebornsense server bootstrap @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
echo "  DEPLOY_PATH=$DEPLOY_PATH"
echo "  REPO_URL=$REPO_URL"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (ssh root@91.98.41.165)"
  exit 1
fi

apt-get update
apt-get install -y git docker.io docker-compose-plugin curl openssh-client
systemctl enable --now docker

mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [[ ! -f "$DEPLOY_KEY" ]]; then
  echo ""
  echo "ERROR: GitHub deploy key not found at $DEPLOY_KEY"
  echo ""
  echo "Create one on the server, add the public key to GitHub repo deploy keys"
  echo "(Settings -> Deploy keys -> Add deploy key, read-only is enough for deploy):"
  echo ""
  echo "  ssh-keygen -t ed25519 -f $DEPLOY_KEY -N '' -C 'rebornsense-vps-deploy'"
  echo "  cat ${DEPLOY_KEY}.pub"
  echo ""
  echo "Also add the same public key to GitHub Actions secrets if CI deploy should work."
  exit 1
fi

chmod 600 "$DEPLOY_KEY"
if [[ -f "${DEPLOY_KEY}.pub" ]]; then
  chmod 644 "${DEPLOY_KEY}.pub"
fi

SSH_CONFIG=/root/.ssh/config
if ! grep -qE '^Host github\.com$' "$SSH_CONFIG" 2>/dev/null; then
  cat >>"$SSH_CONFIG" <<EOF

Host github.com
  HostName github.com
  User git
  IdentityFile $DEPLOY_KEY
  IdentitiesOnly yes
EOF
  chmod 600 "$SSH_CONFIG"
  echo "Configured $SSH_CONFIG for github.com -> $DEPLOY_KEY"
fi

echo "=== Test GitHub SSH ==="
if ! ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 | grep -qi 'successfully authenticated'; then
  echo ""
  echo "ERROR: Cannot authenticate to GitHub with $DEPLOY_KEY"
  echo "Add ${DEPLOY_KEY}.pub as a deploy key on https://github.com/ihtxam/rebornSense/settings/keys"
  exit 1
fi

ensure_git_repo() {
  local path="$1"
  if [[ -d "$path/.git" ]]; then
    echo "Git repo already present: $path"
    return 0
  fi

  if [[ -n "$LEGACY_PATH" && "$path" == "$DEPLOY_PATH" && -d "$LEGACY_PATH" ]]; then
    echo "=== Re-init existing tree at $LEGACY_PATH (no .git) ==="
    cd "$LEGACY_PATH"
    git init
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REPO_URL"
    git fetch origin main
    git checkout -B main
    git reset --hard origin/main
    if [[ "$LEGACY_PATH" != "$DEPLOY_PATH" ]]; then
      echo "=== Symlink $DEPLOY_PATH -> $LEGACY_PATH ==="
      ln -sfn "$LEGACY_PATH" "$DEPLOY_PATH"
    fi
    return 0
  fi

  if [[ -d "$path" ]] && [[ -n "$(ls -A "$path" 2>/dev/null || true)" ]]; then
    echo ""
    echo "ERROR: $path exists but is not a git repository."
    echo "Move it aside or set LEGACY_PATH=$path to re-init git in place:"
    echo "  mv $path ${path}.bak"
    echo "  LEGACY_PATH=${path}.bak DEPLOY_PATH=$path bash $0"
    exit 1
  fi

  echo "=== Clone $REPO_URL -> $path ==="
  git clone "$REPO_URL" "$path"
}

if [[ -n "$LEGACY_PATH" ]]; then
  ensure_git_repo "$LEGACY_PATH"
  if [[ "$LEGACY_PATH" != "$DEPLOY_PATH" && ! -e "$DEPLOY_PATH" ]]; then
    ln -sfn "$LEGACY_PATH" "$DEPLOY_PATH"
  fi
else
  ensure_git_repo "$DEPLOY_PATH"
fi

cd "$DEPLOY_PATH"
chmod +x scripts/deploy-hetzner.sh scripts/setup-rebornsense-server.sh 2>/dev/null || true

echo ""
echo "=== Run deploy ==="
export DEPLOY_STACK DEPLOY_PATH="$DEPLOY_PATH"
exec bash "$DEPLOY_PATH/scripts/deploy-hetzner.sh"
