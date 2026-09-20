# Local demo login (Cursor Desktop)

Repeatable workflow for testing merchant login on **127.0.0.1** before pushing PRs.

## Quick start

```bash
# One command: Postgres + migrate + seed + backend + dashboard
bash scripts/dev-local.sh
```

Then open **http://127.0.0.1:5173/login** (Vite may use **5174**, **5177**, etc. if 5173 is busy — any port works; the `/api` proxy is same-origin).

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| **Merchant (demo shop)** | `demo@rebornsense.com` | `DemoShop123!` |
| Superadmin (optional) | `admin@rebornsense.com` | `RebornAdmin123!` |

Use the **merchant** account for dashboard / WebPOS testing.

## What runs where

| Piece | Port | How it starts |
|-------|------|----------------|
| PostgreSQL | 5432 | `scripts/dev-local-start.sh` (Docker `docker-compose.dev.yml` or native Postgres) |
| API backend | **3000** | `npm run dev` in `backend/` (via `dev-local.sh serve`) |
| Dashboard (Vite) | 5173+ | `npm run dev` in `dashboard/` |

### Cursor Desktop (automatic)

`.cursor/environment.json` is configured so that on environment boot:

1. **`install`** — `npm ci` in `backend/` and `dashboard/`, create `backend/.env` if missing
2. **`start`** — start Postgres, push schema, seed demo accounts
3. **`terminals`** — `bash scripts/dev-local.sh serve` (backend + dashboard)

After boot, run verification manually if needed:

```bash
bash scripts/dev-local.sh verify
```

### Manual commands

```bash
bash scripts/dev-local-install.sh   # deps + backend/.env
bash scripts/dev-local-start.sh     # db + migrate + seed only
bash scripts/dev-local.sh serve     # backend + dashboard
bash scripts/dev-local.sh verify    # health + login curls
bash scripts/dev-local.sh stop      # stop processes started by serve
```

## Verify backend is up

Wrong process on port **3000** (e.g. a shop mock) returns `{"error":"not found"}` and login fails.

```bash
curl -s http://127.0.0.1:3000/api/health
```

Expected:

```json
{"status":"ok","service":"reborn-backend",...}
```

Demo login (direct API):

```bash
curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@rebornsense.com","password":"DemoShop123!"}'
```

Via Vite proxy (replace port if Vite picked another):

```bash
curl -s -X POST http://127.0.0.1:5173/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@rebornsense.com","password":"DemoShop123!"}'
```

## Configuration

- `backend/.env` — created from `backend/.env.example` on first run
- `docker-compose.dev.yml` — Postgres-only compose file (user `manupos` / password `localdev` / db `manupos`)
- `.env.dev.example` — optional overrides for Docker Compose

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login shows **network error** | Dashboard must use same-origin `/api` (Vite proxy). Ensure backend is on **3000**. |
| Login shows **not found** / API unavailable | Port 3000 is not the Reborn backend. Run `curl http://127.0.0.1:3000/api/health` and stop the wrong process. |
| `DATABASE_URL` errors | Run `bash scripts/dev-local-start.sh` or start Postgres: `docker compose -f docker-compose.dev.yml up -d db` |
| Invalid credentials | Re-seed: `cd backend && npx tsx src/db/seed.ts` or `bash scripts/heal-staging-demo-login.sh` (Docker prod) |
