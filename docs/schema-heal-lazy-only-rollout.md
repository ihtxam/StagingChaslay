# Schema heal: migrate + lazy error path only (emergency rollout)

Use this when production still shows API hangs / 502 / “Cannot reach server” **after** non-blocking startup (#894) and auto-heal are live.

## What we are *not* doing

- **Not** removing multi-location or HQ from the codebase (large product change, little stability gain).
- **Not** stopping Drizzle migrations or deploy-time `schema-repair` (those stay the primary DDL path).

## What this mode does

| Layer | `MERCHANT_SCHEMA_BOOTSTRAP=full` (default today) | `MERCHANT_SCHEMA_BOOTSTRAP=lazy` |
| --- | --- | --- |
| Boot `ensureAllMerchantSchema()` | Runs in background after listen | **Skipped** |
| `ensureLocationContextSchema()` on panel/POS routes | Runs once per process (heavy DDL bundle) | **Skipped** |
| `withMerchantSchemaRetry` / `patchMerchantSchemaFromError` | On real missing-column / missing-table errors | **Unchanged** |
| Deploy `migrate` job + `POST /health/schema-repair` | Still run on deploy | **Still run on deploy** |
| `503 SCHEMA_WARMUP` at boot | Until background pass finishes | **No warmup** (ready immediately) |

Lazy mode trades **proactive** hundreds of `ALTER`s for **reactive** patches only when Postgres reports a schema error (plus deploy repair).

## When to flip it

1. Deep health is fast but panel/login still time out under load.
2. API logs show long `[schema]` bursts or event-loop stalls during `ensureAllMerchantSchema` / `ensureLocationContextSchema`.
3. You need breathing room while a proper migration-only pipeline is built.

## Rollout (staging → production)

### 1. Staging (`app.chaslay.com`)

On the staging API container env (e.g. `/root/chaslay-secrets/.env.production` or compose `environment`):

```bash
MERCHANT_SCHEMA_BOOTSTRAP=lazy
```

Recreate API only:

```bash
cd /root/StagingChaslay
docker compose up -d --force-recreate api
```

Verify:

```bash
curl -sS 'https://app.chaslay.com/api/health?deep=1' | jq '{schemaBootstrap,schemaStartup,schemaMaintenance,database}'
```

Smoke: merchant login, PIN, POS catalog load, one order path.

### 2. Production (`app.rebornsense.com`)

Same env on production secrets file used by compose, then:

```bash
cd /root/rebornSense   # or REBORN_HETZNER_DEPLOY_PATH
docker compose up -d --force-recreate api
```

Or merge a deploy marker after documenting the env on the server (env is **not** in git).

Verify deep health + MeliMelo (or busiest merchant) login/POS.

### 3. Rollback

Remove the variable or set `MERCHANT_SCHEMA_BOOTSTRAP=full`, recreate API. No DB rollback required.

## Product: turning off multi-location (your plan)

Independent of lazy schema — do this in **edition / plan / nav**, not by deleting tables:

| Lever | Where |
| --- | --- |
| Cap locations | `max_locations = 1` on merchant or subscription plan (Superadmin / reseller package) |
| Hide HQ UI | Edition features + `panelNavHideHq` / POS-only packages (already used for shop) |
| Staff | No location switcher when only one location row exists |

Existing merchants keep a **single default location** row; POS and panel already assume that.

## Follow-up engineering (after lazy mode stabilizes)

1. **Deploy-only DDL:** run `ensureAllMerchantSchema` only from `scripts/deploy-hetzner.sh` (`schema-repair` POST), never from API boot.
2. **Shrink lazy heal:** map errors to **single-column** patches, not full `ensureMerchantColumnsSchema()`.
3. **Metrics:** alert on `schemaMaintenance: warning` with rising `duplicateColumnKeys` (hot-path regression).

## Code references

- Flag: `backend/src/lib/schema-bootstrap-mode.ts`
- Boot skip: `backend/src/lib/schema-startup-state.ts`, `ensureMerchantSchemaAtStartup()`
- Location middleware skip: `ensureLocationContextSchema()` in `ensure-merchant-schema.ts`
- Error-path heal: `withMerchantSchemaRetry`, `patchMerchantSchemaFromError` (same file)
