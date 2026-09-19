#!/usr/bin/env bash
# Pre-deploy fail-safe: abort before any deploy if production would run a database wipe.
#
# Usage:
#   DEPLOY_STACK=rebornsense bash scripts/pre-deploy-sanity-check.sh
#   DEPLOY_STACK=chaslay RESET_STAGING_DB=1 DEPLOY_PATH=/root/rebornSense bash scripts/pre-deploy-sanity-check.sh  # exits 1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/deploy-production-guard.sh"

pre_deploy_sanity_check
echo "Pre-deploy sanity check passed (DEPLOY_STACK=${DEPLOY_STACK:-unset})."
