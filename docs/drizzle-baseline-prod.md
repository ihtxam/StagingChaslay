# Drizzle baseline on an existing database

`backend/drizzle/0000_baseline_production_schema.sql` is a snapshot of the
schema that production already has. It is written with plain `CREATE TABLE`,
so running it against a database that already holds those tables fails.

On a database that already has the tables, record the baseline as applied
instead of executing it. Do this **once per environment**, before the first
deploy that runs `drizzle-kit migrate`.

## Production — already done (2026-10-26)

```
 id |   hash_prefix    |  created_at
----+------------------+---------------
  1 | 48b8871b71813169 | 1793000712024
```

No further action is needed on `app.rebornsense.com`. `drizzle-kit migrate`
reports nothing to apply there.

## Stamping another environment (staging, a restored copy, a new server)

The two values come from the migration itself, so recompute them rather than
copying the numbers above — they change whenever the baseline is regenerated.

```bash
cd backend
node -e "
const fs=require('fs'),crypto=require('crypto');
const j=JSON.parse(fs.readFileSync('drizzle/meta/_journal.json','utf8'));
for(const e of j.entries){
  const sql=fs.readFileSync('drizzle/'+e.tag+'.sql').toString();
  console.log(e.tag, crypto.createHash('sha256').update(sql).digest('hex'), e.when);
}
"
```

`hash` is the SHA-256 of the whole `.sql` file; `created_at` is the `when`
field of that entry in `meta/_journal.json`. Both come straight from
`readMigrationFiles()` in `drizzle-orm/migrator.js`.

Then, against the target database (the insert is idempotent, so re-running it
is safe):

```sql
CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO "drizzle"."__drizzle_migrations" ("hash","created_at")
SELECT '<hash>', <created_at>
WHERE NOT EXISTS (
  SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '<hash>'
);
```

Against the compose stack:

```bash
docker exec -i <stack>-db-1 sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < stamp.sql
```

## Why a timestamp and not the hash

`PgDialect.migrate()` reads the most recent row by `created_at` and applies a
migration only when `lastDbMigration.created_at < migration.folderMillis`. It
never compares hashes. So:

- a baseline stamped with its own `when` is skipped, because the values are equal
- regenerating the baseline later does not cause it to re-run
- every later migration gets a `when` from the clock, so it is always greater
  and applies normally

## A fresh, empty database needs none of this

Do not stamp an empty database. `drizzle-kit migrate` creates the tables from
`0000` and records it. Stamping first would skip the creation and leave the
database empty.

## After stamping

The runtime repair layer (`run-schema-patches.ts` in the migrate container and
the `POST /health/schema-repair` at the end of `scripts/deploy-hetzner.sh`) is
deliberately left in place as a safety net. Plan to narrow it only after
several deploys have gone through `drizzle-kit migrate` cleanly, and keep the
lazy bootstrap (`MERCHANT_SCHEMA_BOOTSTRAP=lazy`) until that is finished.
