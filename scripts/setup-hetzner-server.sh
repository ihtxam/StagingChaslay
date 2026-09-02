#!/usr/bin/env bash
# First-time Hetzner bootstrap for Chaslay staging (116.202.26.15).
# For Rebornsense production (91.98.41.165) use scripts/setup-rebornsense-server.sh.
#
# Legacy name kept for compatibility — delegates to setup-staging-chaslay-server.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/setup-staging-chaslay-server.sh"
