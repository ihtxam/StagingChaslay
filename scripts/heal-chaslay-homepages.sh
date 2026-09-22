#!/usr/bin/env bash
# Repair Chaslay homepage builder rows (split-brain + legacy CMS refill).
# Runs on deploy via schema-repair; use this script for a targeted production heal.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${CHASLAY_HEAL_API_URL:-https://app.rebornsense.com/api}"
SLUGS="${CHASLAY_HEAL_SLUGS:-demo,brazza-pizza}"

echo "=== Chaslay homepage repair (all CMS-enabled merchants) ==="
curl -fsS -X POST "${API_URL}/health/schema-repair" | head -c 4000 || true
echo

if command -v docker >/dev/null 2>&1 && docker compose ps api >/dev/null 2>&1; then
  echo "=== Targeted slug repair: ${SLUGS} ==="
  SLUGS="$SLUGS" docker compose exec -T api npx tsx -e "
    (async () => {
      const { repairChaslayHomepagesBySlug } = await import('./src/lib/chaslay-homepage-heal.ts');
      const slugs = process.env.SLUGS.split(',').map((s) => s.trim()).filter(Boolean);
      const results = await repairChaslayHomepagesBySlug(slugs);
      console.log(JSON.stringify({ slugs, results }, null, 2));
    })();
  " || echo "WARNING: targeted slug repair failed"
elif [[ -f backend/package.json ]] && command -v npx >/dev/null 2>&1; then
  echo "=== Targeted slug repair: ${SLUGS} (local npx) ==="
  SLUGS="$SLUGS" npx --prefix backend tsx -e "
    import { repairChaslayHomepagesBySlug } from './backend/src/lib/chaslay-homepage-heal.ts';
    const slugs = process.env.SLUGS!.split(',').map((s) => s.trim()).filter(Boolean);
    repairChaslayHomepagesBySlug(slugs).then((results) => {
      console.log(JSON.stringify({ slugs, results }, null, 2));
    });
  " || echo "WARNING: targeted slug repair skipped"
fi

echo "Done. Verify merchant panel: ${API_URL%/api}/merchant/chaslay-page-builder"
