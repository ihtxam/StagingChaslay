#!/usr/bin/env bash
# Fail when backend/src/db/schema.ts describes something that has no migration file.
#
# Deploys apply migrations with `drizzle-kit migrate`, which only runs the .sql
# files committed under backend/drizzle/. Editing schema.ts without running
# `npx drizzle-kit generate` therefore deploys green while the column or table
# is silently missing in the database. This catches that before merge.
#
# The probe below runs `generate` for real, so it can write a .sql file, a new
# meta/<n>_snapshot.json and an entry in meta/_journal.json. Everything is
# snapshotted first and restored on exit, so running this leaves the working
# tree exactly as it was found — otherwise a local run would corrupt the
# migration state it is meant to protect.
#
# Usage: bash scripts/check-migrations-generated.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

if [[ ! -d node_modules ]]; then
  echo "check-migrations: installing backend dependencies…"
  npm ci --no-audit --no-fund >/dev/null
fi

WORK="$(mktemp -d)"
restore() {
  # Put drizzle/ back exactly as it was, whatever happened.
  if [[ -d "$WORK/meta" ]]; then
    rm -rf drizzle/meta
    cp -R "$WORK/meta" drizzle/meta
  fi
  if [[ -f "$WORK/sql-list" ]]; then
    while IFS= read -r keep; do :; done < "$WORK/sql-list"
    for f in drizzle/*.sql; do
      [[ -e "$f" ]] || continue
      grep -Fxq "$f" "$WORK/sql-list" || rm -f "$f"
    done
  fi
  rm -rf "$WORK"
}
trap restore EXIT

cp -R drizzle/meta "$WORK/meta"
ls drizzle/*.sql 2>/dev/null | sort > "$WORK/sql-list" || : > "$WORK/sql-list"

# generate is a no-op ("No schema changes, nothing to migrate") when schema.ts
# matches the latest snapshot. If it writes a file, a change was never generated.
npx drizzle-kit generate --name ci_missing_migration_check >/dev/null 2>&1 || true

ls drizzle/*.sql 2>/dev/null | sort > "$WORK/sql-after" || : > "$WORK/sql-after"
new_files="$(comm -13 "$WORK/sql-list" "$WORK/sql-after" || true)"

if [[ -z "$new_files" ]]; then
  echo "check-migrations: OK — schema.ts matches the committed migrations."
  exit 0
fi

echo "=============================================================="
echo "  MISSING MIGRATION"
echo "=============================================================="
echo
echo "backend/src/db/schema.ts has changes with no migration file."
echo "Deploys run 'drizzle-kit migrate', which only applies committed"
echo "migrations — so these changes would NOT reach the database."
echo
echo "The migration that should have been committed:"
echo
for f in $new_files; do
  echo "--- $(basename "$f") ---"
  sed 's/^/    /' "$f"
done
echo
echo "To fix, from the repo root:"
echo
echo "    cd backend && npx drizzle-kit generate --name <short_description>"
echo "    git add backend/drizzle"
echo
echo "Then commit the generated .sql file and meta/ snapshot with your change."
echo "=============================================================="

exit 1
