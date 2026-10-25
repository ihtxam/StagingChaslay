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
- **Staging:** `Staging health watch` — same probes for `https://app.chaslay.com`.
- **Enable alerts (email):** GitHub → your profile **Settings → Notifications** → **Actions** → check **Send notifications for failed workflows** (and pick email).
- **Slack:** Install the [GitHub Slack app](https://slack.github.com/), subscribe the `#ops` channel to `ihtxam/rebornSense` **Workflow runs** (failed only). You get a link to the failed health-watch log — no custom webhook required.
- **What to do when an alert fires:**
  1. Open the failed **Production health watch** run → see which step failed (502 vs DB).
  2. If **login/POS down now:** run **Restart Rebornsense production** (below) — ~2 minutes, no rebuild.
  3. If restart does not hold (<30 min): check API logs (`docker compose logs api --tail=200`), look for `[schema]` / OOM; schedule a **deploy with the schema-storm fix** on `main`, not a git revert.
  4. Auto-heal may already have run (see **Production API auto-heal** workflow every 5 min) — confirm `GET /api/health?deep=1` is 200 before telling the client.

## Auto-heal (opt-in, production + staging)

- **Script:** `scripts/api-auto-heal.sh` on the Hetzner host.
- **Behaviour:** Every run probes `…/api/health?deep=1`. On success → failure counter = 0. On failure → increment; at **3** failures → **restart API + Caddy** (same as emergency restart), then **1 hour cooldown** before another heal (avoids restart loops during a bad deploy).
- **Does it prevent login/POS breakups?** It **shortens** outages when the API is **stuck** (event loop blocked, hung process, Caddy 502) but **does not fix** bad code on every request. Schema-storm fixes must still be **deployed**.
- **GitHub:** workflows **Production API auto-heal** and **Staging API auto-heal** (every 5 minutes via SSH). Ensure `REBORN_HETZNER_*` / `HETZNER_*` secrets are set (same as deploy).
- **Manual:** `workflow_dispatch` on **Production health watch** with **run auto-heal after failure** after a failed probe.

## Emergency response

1. Confirm: `curl -sS -o /dev/null -w '%{http_code}\n' 'https://app.rebornsense.com/api/health?deep=1'`
2. **Restart without full rebuild:** Actions → **Restart Rebornsense production** → Run workflow  
   Recreates `api`, `dashboard`, and `caddy` containers, waits, curls `/health`. **Does not** roll back code — fixes **stuck** API, not a broken release.
3. **Full deploy:** merge to `main`, touch `.deploy/rebornsense-production`, push (triggers deploy + health verify)

## Should we undo last night’s pushes?

**Usually no.** Outages starting after those pushes were caused by **schema work running too often** (API hang / 502), fixed in `main` by memoized schema + startup-only patches. **Reverting** removes the fix and leaves the old storm behaviour. The right recovery is:

1. **Restart** (immediate breathing room for clients).
2. **Deploy current `main`** to production (permanent fix) after staging `deep=1` shows `schemaMaintenance: ok`.
3. Keep **auto-heal** + **health watch** so you are not watching 24/7.

Staging repeated the issue when the server **git-pulled an old StagingChaslay mirror** or the API **restarted** during deploy — not because the code fix was wrong. Use `SKIP_GIT_SYNC=1` on staging until the mirror is synced.

## Staging first

Validate on `https://app.chaslay.com/api/health?deep=1` before production deploy markers.

## Esendex SMS (staging / prod)

1. **Superadmin → Settings** → section **Esendex SMS** (maps to `ESENDEX_*` in `backend/.env.example`).
2. Save API user, account ref, password/key, default sender — or set the same keys in server env.
3. **Superadmin → Merchants** → enable **SMS (Esendex)** + tier on a test merchant.
4. Smoke: merchant **SMS** page → send test SMS; shop login OTP if enabled.

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
