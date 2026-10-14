#!/usr/bin/env bash
# Export recent merge commits so Published PRs works without a GitHub token
# (private repos 404 when the API has no PAT).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/backend/public/published-prs.snapshot}"
cd "$ROOT"
mkdir -p "$(dirname "$OUT")"
REF="${PUBLISHED_PRS_REF:-origin/main}"
if ! git rev-parse --verify "$REF" >/dev/null 2>&1; then
  REF=HEAD
fi
git log "$REF" --merges -n 250 --pretty=format:'===%n%aI%n%an%n%s%n%b' >"$OUT"
echo "Wrote $(grep -c '^Merge pull request #' "$OUT" || true) merged PRs to $OUT"
