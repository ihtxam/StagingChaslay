# ManuPOS panel integrated into FoodTruckPOS

## What changed
- **Kept:** `app/` Android POS (Kotlin)
- **Replaced:** legacy `backend/public/admin` + `shop.html` with ManuPOS **backend + dashboard + online shop**
- **Added:** `/v1/*` Reborn Android API compatibility (license, sync, orders, receipts)

## Deploy
**Staging sync (rebornSense → StagingChaslay):** add GitHub Actions secret **`STAGING_CHASLAY_SYNC_TOKEN`** on **rebornSense** (classic PAT: `repo` + `workflow`, or fine-grained **Contents + Workflows** write on `ihtxam/StagingChaslay`). Sync keeps StagingChaslay’s own `.github/workflows/`; a token without **workflow** scope is fine for routine code mirrors. Details: `DEPLOY.md` § StagingChaslay sync.

1. Copy `.env.production.example` → `.env.production` and set secrets
2. For Reborn domains use `deploy/Caddyfile.chaslay`
3. `docker compose up -d --build`
4. `docker compose run --rm migrate`

## Android app
Set in `app/build.gradle.kts`:
- `LICENSE_API_BASE_URL` → your API host (e.g. `https://app.rebornsense.com/`)
- `SYNC_API_KEY` → merchant **sync API key** from ManuPOS superadmin (Merchants detail)

### POS remote diagnostics (debug builds)
- **Debug APKs** upload crash/support logs to **staging only**: `https://app.chaslay.com/v1/sync/diagnostic-report` (override via `diagnosticApiBaseUrl` in `local.properties`).
- **Release APKs** use `LICENSE_API_BASE_URL` for diagnostics (production merchant support).
- Staging server runs with `DEPLOY_STACK=chaslay` (see `DEPLOY.md`); route is shared with production code in `backend/src/routes/chaslay/pos-diagnostics.handler.ts`.
- **Read uploads:** superadmin → **System logs** at `https://app.chaslay.com/superadmin/logs`, filter category **merchant_diagnostic** (API: `GET /api/superadmin/system-logs?category=merchant_diagnostic`).

## Superadmin panel
- `https://admin.yourdomain.com` or main domain `/superadmin`
- Create merchants + device license keys there

## License activation
Use license keys generated in ManuPOS superadmin as Android activation codes.
