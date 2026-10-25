# Production uptime (app.rebornsense.com)

## What is fixed in code (permanent)

| Layer | Fix | Recurrence risk |
| --- | --- | --- |
| PIN keypad UI | Touch `pointerdown`, keys stay active during verify, honest 502 copy | Low — merged to `main` |
| Schema on hot path | `ensureLocationContextSchema()` + memoized column/location patches (once per API process) | Low if this build is deployed |
| Startup | `ensureMerchantSchemaAtStartup()` before `listen` | Low |
| Deploy gate | Post-deploy curl ` /api/health?deep=1` fails the workflow if API/DB not OK | Catches bad deploys |

## What can still cause outages

- Hetzner host disk/RAM, Docker daemon, or Postgres container crash
- Bad deploy (mitigated by post-deploy health step)
- Manual schema drift without migration (mitigated by startup + retry helpers)

## Monitoring

- **GitHub Actions:** `Production health watch` — every 10 minutes checks:
  - `https://app.rebornsense.com/api/health`
  - `https://app.rebornsense.com/api/health?deep=1` (includes DB `SELECT 1`)
  - `https://app.rebornsense.com/api/public/status` database component
- **Enable alerts:** GitHub repo → Settings → Notifications → Actions → failed workflows (email). Optional: Slack/email via GitHub Apps.

## Emergency response

1. Confirm: `curl -sS -o /dev/null -w '%{http_code}\n' 'https://app.rebornsense.com/api/health?deep=1'`
2. **Restart without full rebuild:** Actions → **Restart Rebornsense production** → Run workflow
3. **Full deploy:** merge to `main`, touch `.deploy/rebornsense-production`, push (triggers deploy + health verify)

## Staging first

Validate on `https://app.chaslay.com/api/health?deep=1` before production deploy markers.

## Incident process (login / API / PIN)

For **P0** issues (cannot log in, widespread 502, PIN gate broken):

1. **Fix on `main`** and verify on **staging** (`app.chaslay.com`) — health, login, PIN, one merchant smoke path.
2. **Same incident window:** schedule **production** deploy (touch `.deploy/rebornsense-production` on `main`) — usually **off-peak** unless prod is already down.
3. **Do not close** the incident until:
   - `GET /api/health?deep=1` → 200, `database: ok`
   - Post-deploy workflow step is green
   - A human confirms login + PIN on a real merchant account
4. If deploy fails health gate: use **Restart Rebornsense production**, then re-run deploy or investigate logs — do not leave “merged to GitHub” as the end state.

## Schema maintenance guardrails

- **Never** run full `ensure*` schema walks on every HTTP request — use startup + memoized `ensureLocationContextSchema()` (and column caches in `runPatch`).
- **Logs:** `[schema-metrics]` warnings when the same `ensure*` or column patch runs more than once per API process.
- **Probe:** `GET /api/health?deep=1` includes `schemaMetrics` and `schemaMaintenance` (`ok` | `warning`) for ops dashboards.
- If `schemaMaintenance` is `warning` after deploy, treat as a release blocker on staging before production.
