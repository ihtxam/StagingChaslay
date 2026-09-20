#!/usr/bin/env bash
# One-time / idempotent dependency install for local demo login (Cursor Desktop + cloud agents).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing backend dependencies"
(cd backend && npm ci)

echo "==> Installing dashboard dependencies"
(cd dashboard && npm ci)

echo "==> Ensuring backend/.env exists"
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "    Created backend/.env from backend/.env.example"
fi

echo "==> dev-local-install complete"
