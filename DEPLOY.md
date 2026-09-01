# Reborn POS — deploy checklist

Product name: **Reborn**. Login and API: **https://app.rebornsense.com** (same `/api` and `/v1` paths as before).

| Domain | Purpose |
|--------|---------|
| `app.rebornsense.com` | Login, merchant panel, Web POS, Android `/v1` + `/api` |
| `api.rebornsense.com` | Optional API alias (same backend) |
| `pay.rebornsense.com` | Digital receipt pages (`/receipt/{id}`) |
| `shop.rebornsense.com/{slug}` | Customer online shop |
| `status.rebornsense.com` | Public system status |
| `rebornsense.com` | Redirects to `app.rebornsense.com` |

New production IP: **`91.98.41.165`**. Previous IP: `116.202.26.15`.

This host already serves other nginx sites (wearedispatcher). Reborn uses Docker on `127.0.0.1:13000` (API) and `127.0.0.1:13080` (dashboard), with `deploy/nginx-rebornsense.conf` — do **not** bind Caddy to :80/:443 there.

---

## Transfer to the new server

1. Point DNS (and `*.rebornsense.com` wildcard) at the new server.
2. Copy `/root/chaslay-secrets/.env.production` (or dump Postgres) from the old box so merchants, licenses, and passwords stay the same.
3. On the new server: clone this repo, set `DOMAIN=rebornsense.com` and `PUBLIC_APP_URL=https://app.rebornsense.com` in secrets, then run `bash scripts/deploy-hetzner.sh`.
4. Add `noreply@rebornsense.com` in Brevo (or keep the current sender until DNS mail is ready).
5. After cutover, point old `*.chaslay.com` records at the new server so bookmarks redirect (Caddy already maps them).
6. Sideload a new Android APK (API base is now `https://app.rebornsense.com/`). Installed Windows Print Agent keeps working; UI name is **Reborn Print Agent**.

---

## 1. DNS (you)

Point these **A records** to the new server IP:

- `app.rebornsense.com`
- `api.rebornsense.com` (optional)
- `pay.rebornsense.com`
- `shop.rebornsense.com`
- `status.rebornsense.com`
- `rebornsense.com` / `www.rebornsense.com`
- `*.rebornsense.com` (shop subdomains)

---

## 2. First-time server setup (Hetzner)

```bash
ssh root@116.202.26.15
git clone https://github.com/ihtxam/FoodTruckPOS.git
cd FoodTruckPOS
cp backend/.env.example backend/.env
cp backend/receipts.env.example backend/receipts.env
nano backend/.env
nano backend/receipts.env
bash scripts/deploy-hetzner.sh
```

### WinSCP ? where files live on the server

After `git clone`, everything is under **`/root/FoodTruckPOS/`**:

| What | Path on server |
|------|----------------|
| Main API secrets | `/root/chaslay-secrets/backend.env` (symlinked from `backend/.env`) |
| Receipts + SMTP | `/root/chaslay-secrets/receipts.env` |
| Receipts code | `/root/FoodTruckPOS/backend/receipts/` |
| Docker stack | `/root/FoodTruckPOS/backend/docker-compose.yml` |
| Deploy script | `/root/FoodTruckPOS/scripts/deploy-hetzner.sh` |

There is **no** separate `server/` folder anymore ? receipts live inside `backend/`.

If you only uploaded `backend/` before, run on the server (SSH):

```bash
cd /root/FoodTruckPOS && git pull
```

Or re-clone: `git clone https://github.com/ihtxam/FoodTruckPOS.git`

Then create `backend/receipts.env` from `backend/receipts.env.example` and run:

```bash
bash /root/FoodTruckPOS/scripts/deploy-hetzner.sh
```

**Do not commit `.env` files to GitHub** ? they contain passwords. Keep secrets on the server only, or use [GitHub Actions secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) for deploy keys (not app config).

---

## 3. Deploy workflows

**Staging first, production second.** Test every change on Chaslay before it reaches Rebornsense.

| Step | When user says | What to do | Result |
|------|----------------|------------|--------|
| 1 — **Staging** | merge to `main` / push to **test** / **chaslay** | Merge PR to `rebornSense` `main` (auto-syncs to StagingChaslay) or run `bash scripts/agent-deploy.sh staging` | `app.chaslay.com` updates |
| 2 — **Verify** | — | QA on `app.chaslay.com` | — |
| 3 — **Production** | push to **production** / **reborn** | Run `bash scripts/agent-deploy.sh production` (touches `.deploy/rebornsense-production` and pushes `main`) | `app.rebornsense.com` updates |

Pushing to `rebornSense` `main` **auto-deploys staging** (via `sync-staging-chaslay.yml`). Production still requires an explicit deploy trigger (`.deploy/rebornsense-production` or `agent-deploy.sh production`).

| Environment | Repo | Server | Path | How it deploys |
|-------------|------|--------|------|----------------|
| Chaslay test/staging | [StagingChaslay](https://github.com/ihtxam/StagingChaslay) | `116.202.26.15` | `/root/StagingChaslay` | Auto on push to `main` in StagingChaslay (usually via sync workflow) |
| Rebornsense production | [rebornSense](https://github.com/ihtxam/rebornSense) (this repo) | `91.98.41.165` | `/root/rebornSense` | Manual: **Actions → Deploy to Rebornsense** |

When asking an agent to deploy, always specify **test/chaslay** or **production/reborn**.

| Environment | Workflow | Trigger | Server secret | Stack | Domains |
|-------------|----------|---------|---------------|-------|---------|
| Chaslay test/staging | `deploy-hetzner.yml` in **StagingChaslay** | Auto on push to `main` | `HETZNER_*` | `chaslay` | `app.chaslay.com`, … |
| Rebornsense production | `deploy-rebornsense.yml` in **rebornSense** | Manual (`workflow_dispatch`) | `REBORN_HETZNER_*` | `rebornsense` | `app.rebornsense.com`, … |
| Test sync | `sync-staging-chaslay.yml` in **rebornSense** | Auto on push to `main` | `STAGING_CHASLAY_SYNC_TOKEN` | — | Copies code → StagingChaslay |

### Cloud Agent deploy (SSH + scripts)

Cloud Agents can deploy directly to Hetzner when SSH keys are configured as **Cursor environment secrets** (not in git). The repo ships `.cursor/environment.json`, which runs `scripts/cloud-agent-setup-ssh.sh` on boot.

| Cursor secret | Same value as | Purpose |
|---------------|---------------|---------|
| `STAGING_HETZNER_SSH_KEY` | StagingChaslay `HETZNER_SSH_KEY` | SSH to `116.202.26.15` (`staging-chaslay`) |
| `PRODUCTION_HETZNER_SSH_KEY` | rebornSense `REBORN_HETZNER_SSH_KEY` | SSH to `91.98.41.165` (`production-reborn`) |

Optional overrides: `STAGING_HETZNER_HOST`, `STAGING_HETZNER_USER`, `PRODUCTION_HETZNER_HOST`, `PRODUCTION_HETZNER_USER`.

**Agent workflow after merging a fix to `main`:**

```bash
# 1) Staging (GitHub sync — default; waits for Actions + health check)
bash scripts/agent-deploy.sh staging

# Or fast path when SSH is configured (pull + deploy on server):
bash scripts/agent-deploy.sh staging-ssh

# 2) Production (only after user confirms staging QA)
bash scripts/agent-deploy.sh production
# Or: bash scripts/agent-deploy.sh production-ssh
```

`agent-deploy.sh both` runs staging then production in one command — use only when the user explicitly asks to deploy both.

Test SSH from an agent: `ssh staging-chaslay hostname` should print the staging host name.

### Chaslay test server (StagingChaslay repo)

Configure secrets in **StagingChaslay** → Settings → Secrets and variables → Actions (not in this repo):

| Secret | Example |
|--------|---------|
| `HETZNER_HOST` | `116.202.26.15` |
| `HETZNER_USER` | `root` |
| `HETZNER_SSH_KEY` | Private key (PEM) that can SSH to the Chaslay server |
| `HETZNER_DEPLOY_PATH` | `/root/StagingChaslay` (optional) |
| `HETZNER_DEPLOY_STACK` | `chaslay` (optional; default is `chaslay`) |
| `HETZNER_SSH_PORT` | `22` (optional) |

Every `git push` to `main` in **StagingChaslay** deploys to the test server.

### Rebornsense production (`app.rebornsense.com`)

`app.rebornsense.com` runs on a **separate** VPS:

| | |
|--|--|
| **Server IP** | `91.98.41.165` |
| **Deploy path** | `/root/rebornSense` |
| **Legacy path** | `/root/FoodTruckPOS` (old name; may exist without `.git`) |
| **Repo** | `git@github.com:ihtxam/rebornSense.git` (private) |
| **Stack flag** | `DEPLOY_STACK=rebornsense` |

Add these secrets (do **not** reuse `HETZNER_HOST` for production):

| Secret | Example |
|--------|---------|
| `REBORN_HETZNER_HOST` | `91.98.41.165` |
| `REBORN_HETZNER_USER` | `root` |
| `REBORN_HETZNER_SSH_KEY` | Private key for the Rebornsense server |
| `REBORN_HETZNER_DEPLOY_PATH` | `/root/rebornSense` (optional) |

Workflow: `.github/workflows/deploy-rebornsense.yml` (auto on push to `main` in this repo).

Caddy config: `deploy/Caddyfile.rebornsense`

**Why two repos?** Each repo deploys only to its own server. Do not add Chaslay deploy workflows here or Rebornsense workflows in StagingChaslay.

### StagingChaslay sync (push to test)

Cloud agents and `cursor[bot]` **cannot** push to `ihtxam/StagingChaslay` (403 — no write access). The default `GITHUB_TOKEN` in Actions also **cannot** push to another repo without a PAT.

**One-time setup** (your GitHub account, ~2 minutes):

1. Create a [fine-grained PAT](https://github.com/settings/tokens?type=beta) or [classic PAT](https://github.com/settings/tokens) with **`repo`** scope (write access to `ihtxam/StagingChaslay`).
2. In **rebornSense** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - Name: `STAGING_CHASLAY_SYNC_TOKEN`
   - Value: the PAT
3. To deploy to test: **Actions** → **Sync to StagingChaslay** → **Run workflow** (pick branch if not `main`).

The sync workflow swaps in `.github/staging-overlay/deploy-hetzner.yml` and strips rebornSense-only workflows before pushing. That push triggers the Chaslay auto-deploy on `app.chaslay.com`. Histories may diverge — the workflow **force-pushes** by default.

**Do not run Deploy to Rebornsense until you have verified the same code on staging.**

**Alternative (not recommended for agents):** add `cursor[bot]` as a collaborator on StagingChaslay (Settings → Collaborators → Add people → invite `cursor[bot]` with Write). Manual pushes would work but still fail in unattended agent runs without your OAuth.

#### First-time / broken deploy on `91.98.41.165`

If `bash scripts/deploy-hetzner.sh` fails with **`fatal: not a git repository`**, the server tree was copied or cloned without git history. Fix with one of the options below (run on the server as **root**).

**Prerequisite:** GitHub deploy key at `/root/.ssh/rebornsense_deploy` (public key added under repo **Settings → Deploy keys** on `ihtxam/rebornSense`). You likely already have this for GitHub Actions.

**Option A — fresh clone to `/root/rebornSense` (recommended):**

```bash
ssh root@91.98.41.165

mkdir -p /root/.ssh && chmod 700 /root/.ssh
cat >> /root/.ssh/config <<'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/rebornsense_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
ssh -T git@github.com   # expect: "Hi ihtxam/rebornSense! ... successfully authenticated"

# If old non-git tree exists, move it aside (keeps secrets/docker volumes on disk)
mv /root/FoodTruckPOS /root/FoodTruckPOS.bak 2>/dev/null || true

git clone git@github.com:ihtxam/rebornSense.git /root/rebornSense
export DEPLOY_STACK=rebornsense
export DEPLOY_PATH=/root/rebornSense
bash /root/rebornSense/scripts/setup-rebornsense-server.sh
```

**Option B — re-init git in existing `/root/FoodTruckPOS` (keep same path):**

```bash
ssh root@91.98.41.165

# SSH config (same as option A) if not already set
mkdir -p /root/.ssh && chmod 700 /root/.ssh
grep -q 'IdentityFile /root/.ssh/rebornsense_deploy' /root/.ssh/config 2>/dev/null || cat >> /root/.ssh/config <<'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/rebornsense_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config

cd /root/FoodTruckPOS
git init
git remote add origin git@github.com:ihtxam/rebornSense.git
git fetch origin main
git checkout -B main
git reset --hard origin/main

export DEPLOY_STACK=rebornsense
export DEPLOY_PATH=/root/FoodTruckPOS
bash /root/FoodTruckPOS/scripts/deploy-hetzner.sh
```

**Option C — one-liner bootstrap script (after clone or if script is present):**

```bash
ssh root@91.98.41.165 'LEGACY_PATH=/root/FoodTruckPOS DEPLOY_PATH=/root/rebornSense bash -s' <<'EOF'
set -euo pipefail
if [[ ! -f /root/rebornSense/scripts/setup-rebornsense-server.sh ]]; then
  echo "Clone first: git clone git@github.com:ihtxam/rebornSense.git /root/rebornSense"
  exit 1
fi
bash /root/rebornSense/scripts/setup-rebornsense-server.sh
EOF
```

After a successful deploy, `https://app.rebornsense.com/` should show the **Reborn** brand (not the old teal `#0f766e` Chaslay theme).

#### Recover ALL legacy data (merchants, products, orders, uploads)

`docker-compose.yml` defines volumes `postgres_data` and `uploads_data`. Docker prefixes them with the compose **project name** (directory basename):

| Stack | Path | Project | Postgres volume | Uploads volume |
|-------|------|---------|-----------------|----------------|
| Legacy FoodTruckPOS | `/root/FoodTruckPOS` | `foodtruckpos` | `foodtruckpos_postgres_data` | `foodtruckpos_uploads_data` |
| Rebornsense | `/root/rebornSense` | `rebornsense` | `rebornsense_postgres_data` | `rebornsense_uploads_data` |

Old volumes are **not** removed when the new stack deploys — data remains on disk unless volumes were deleted manually.

**Inspect on the server (safe, read-only):**

```bash
ssh root@91.98.41.165

docker volume ls | grep -E 'postgres|uploads'
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'db|foodtruck|reborn'

cd /root/rebornSense
DRY_RUN=1 bash scripts/recover-rebornsense-data.sh
```

**Automated recovery (backs up current Rebornsense volumes first; does not delete old volumes):**

```bash
ssh root@91.98.41.165
cd /root/rebornSense
git pull origin main
CONFIRM=1 bash scripts/recover-rebornsense-data.sh
```

The script:

1. Backs up `rebornsense_postgres_data` and `rebornsense_uploads_data` to `/root/rebornsense-recovery-backups/<timestamp>/`
2. Stops Rebornsense `api` / `dashboard` / `migrate` (keeps `db` running)
3. `pg_dump` from `foodtruckpos_postgres_data` (or `foodtruckpos-db-1` if still running)
4. `pg_restore` into Rebornsense Postgres
5. Copies uploads `foodtruckpos_uploads_data` → `rebornsense_uploads_data` (`cp -an` merge)
6. Runs `migrate`, restarts the stack

After recovery, log in at **https://app.rebornsense.com/login** with **legacy** superadmin or merchant credentials.

**Alternative: point Rebornsense at old volumes (fast, risky)**

Edit `docker-compose.yml` volumes:

```yaml
volumes:
  postgres_data:
    external: true
    name: foodtruckpos_postgres_data
  uploads_data:
    external: true
    name: foodtruckpos_uploads_data
```

Risks: `migrate` may alter the legacy data directory; both stacks cannot use one Postgres volume; rollback requires editing compose again. Prefer `scripts/recover-rebornsense-data.sh` so old volumes stay untouched.

Manual deploy anytime:

```bash
ssh root@91.98.41.165 'export DEPLOY_STACK=rebornsense DEPLOY_PATH=/root/rebornSense && bash /root/rebornSense/scripts/deploy-hetzner.sh'
```

| Problem | Fix |
|---------|-----|
| `not a git repository` | Use Option A or B above; deploy always runs `git fetch` |
| `Permission denied (publickey)` on clone | Add `/root/.ssh/rebornsense_deploy.pub` to GitHub deploy keys |
| `404` on `https://github.com/.../rebornSense` in browser | Repo is private — use SSH (`git@github.com:...`), not HTTPS without a PAT |
| `Bind for 0.0.0.0:80 failed: port is already allocated` | Old stack still running (often `/root/FoodTruckPOS`). See [Port 80/443 already in use](#port-80443-already-in-use-rebornsense) below |
| Old teal UI still showing | Deploy never completed; run bootstrap + deploy again |
| Wrong path in GitHub Actions | Set `REBORN_HETZNER_DEPLOY_PATH=/root/rebornSense` |

#### Port 80/443 already in use (Rebornsense)

Caddy needs host ports **80** and **443**. If an old FoodTruckPOS / Chaslay compose stack is still up, `rebornsense-caddy-1` fails with `port is already allocated`.

**Find what holds the ports (run on `91.98.41.165`):**

```bash
docker ps --filter publish=80 --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
docker ps --filter publish=443 --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
ss -tlnp | grep -E ':80 |:443 '
```

**Stop the old stack safely, then finish Rebornsense deploy:**

```bash
# Stop legacy FoodTruckPOS / backend compose (common culprit)
cd /root/FoodTruckPOS 2>/dev/null && docker compose down --remove-orphans || true
cd /root/FoodTruckPOS/backend 2>/dev/null && docker compose down --remove-orphans || true
docker compose -p foodtruckpos down --remove-orphans 2>/dev/null || true
docker compose -p backend down --remove-orphans 2>/dev/null || true

# Start / complete Rebornsense (deploy script now stops conflicts automatically)
export DEPLOY_STACK=rebornsense DEPLOY_PATH=/root/rebornSense
bash /root/rebornSense/scripts/deploy-hetzner.sh
```

**Verify Reborn branding (burgundy `#800020`, not teal `#0f766e`):**

```bash
curl -sI https://app.rebornsense.com/ | head -5
curl -sL https://app.rebornsense.com/ | grep -E 'theme-color|#800020|#0f766e' | head -3
```

Expect `theme-color` content `#800020`. Teal `#0f766e` means the old stack or a failed deploy is still serving traffic.

#### Rebornsense SSL (`ERR_SSL_PROTOCOL_ERROR`)

Symptom: HTTP redirects to HTTPS, but `curl -vk https://app.rebornsense.com` fails with **TLS alert internal error** / browser shows `ERR_SSL_PROTOCOL_ERROR`.

**Cause:** Caddy is serving with `deploy/Caddyfile.chaslay` (compose default). `app.rebornsense.com` then hits the catch-all `https:// { tls on_demand }` block; the API `/api/shop/tls-ask` rejects it, so **no certificate** is issued.

**Fix on `91.98.41.165`:**

```bash
ssh root@91.98.41.165
cd /root/rebornSense

# 1) Ensure env points at the Rebornsense Caddyfile
grep -E '^(DOMAIN|CADDYFILE|ACME_EMAIL)=' /root/chaslay-secrets/.env.production
# Expected:
#   DOMAIN=rebornsense.com
#   CADDYFILE=./deploy/Caddyfile.rebornsense
#   ACME_EMAIL=admin@rebornsense.com

# If CADDYFILE is missing or wrong:
sed -i 's|^CADDYFILE=.*|CADDYFILE=./deploy/Caddyfile.rebornsense|' /root/chaslay-secrets/.env.production \
  || echo 'CADDYFILE=./deploy/Caddyfile.rebornsense' >> /root/chaslay-secrets/.env.production
sed -i 's|^DOMAIN=.*|DOMAIN=rebornsense.com|' /root/chaslay-secrets/.env.production
grep -q '^ACME_EMAIL=' /root/chaslay-secrets/.env.production \
  || echo 'ACME_EMAIL=admin@rebornsense.com' >> /root/chaslay-secrets/.env.production

# 2) Stop any old stack still binding 80/443
docker compose -p foodtruckpos down --remove-orphans 2>/dev/null || true
cd /root/FoodTruckPOS 2>/dev/null && docker compose down --remove-orphans || true

# 3) Recreate Caddy with correct mount + reload
export DEPLOY_STACK=rebornsense DEPLOY_PATH=/root/rebornSense
docker compose --env-file .env.production up -d --force-recreate caddy
docker compose --env-file .env.production exec -T caddy caddy reload --config /etc/caddy/Caddyfile

# 4) Diagnose
docker logs rebornsense-caddy-1 --tail 80
docker compose --env-file .env.production exec -T caddy head -20 /etc/caddy/Caddyfile
curl -vk https://app.rebornsense.com/ 2>&1 | head -30
```

If ACME still fails after the correct Caddyfile is mounted, clear stale certs and retry:

```bash
docker compose --env-file .env.production stop caddy
docker volume rm rebornsense_caddy_data rebornsense_caddy_config 2>/dev/null || true
docker compose --env-file .env.production up -d caddy
```

Manual deploy anytime:

```bash
ssh root@116.202.26.15 'bash /root/FoodTruckPOS/scripts/deploy-hetzner.sh'
```

---

## 4. Deploy / update backend manually

```bash
ssh root@116.202.26.15
cd RebornPOS   # or git clone https://github.com/ihtxam/RebornPOS.git
git pull
cd backend
# NEVER run: cp .env.example .env  (that wipes your secrets)
# Secrets live at /root/chaslay-secrets/backend.env ? see scripts/deploy-hetzner.sh
nano /root/chaslay-secrets/backend.env   # only if you need to change secrets
docker compose up -d --build
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

**Editions + Resellers:** After deploy, ensure schema then seed agency:

```bash
docker compose --env-file .env.production exec -T db \
  psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
  < backend/sql/ensure-editions-resellers.sql
# or: docker compose exec api npm run migrate
# Then seed editions + Reborn agency reseller:
docker compose exec api npm run seed
# Default agency login: SEED_RESELLER_EMAIL / SEED_RESELLER_PASSWORD
# (defaults: agency@rebornsense.com / ChaslayAgency123!)
```

**Overview report email settings:** Merchants can schedule daily/monthly Excel report emails from Overview → Settings. Persist column:

```bash
docker compose --env-file .env.production exec -T db \
  psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
  < backend/sql/ensure-report-email-settings.sql
```

The API hourly job sends daily reports after midnight (Europe/Zurich) and monthly reports on the 1st (from 06:00), using merchant SMTP or platform Brevo.

**Cash shifts (WebPOS):** Schema is applied by `drizzle-kit push` in the `migrate` service. If Settings → POS → Operations (“Require cash shifts”) fails to save, or WebPOS never shows Start/Close shift, run the idempotent SQL once:

```bash
# from repo root on the server
docker compose --env-file .env.production exec -T db \
  psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
  < backend/sql/ensure-shifts.sql
```

Then open **Settings → POS → Operations**, turn **Require cash shifts** on, and **Save**. WebPOS should show the Shift button / start banner.

- Opening float is optional (blank = 0).
- Open shifts that cross the calendar day auto-close at **23:59 Europe/Zurich** (counted = expected). Late-night venues (e.g. until 2:00): keep shifts **off** — WebPOS shows an **End of day** button instead (needs `END_OF_DAY` / `VIEW_REPORTS`).
- Waiters do not get `VIEW_REPORTS` / `END_OF_DAY` (no company sales totals).

See `backend/sql/ensure-shifts.sql`.

**`.env` secrets:**

| Variable | Notes |
|----------|--------|
| `POSTGRES_PASSWORD` | Long random password |
| `API_KEY` | Global fallback key; also assigned to `demo` tenant on seed |
| `LICENSE_SECRET` | Min 32 chars |
| `SUPERADMIN_PASSWORD` | Set once in `/root/chaslay-secrets/backend.env`; stored in Postgres and survives redeploys |

`Caddyfile` is already set for `app.rebornsense.com`, `shop.rebornsense.com`, `app.rebornsense.com`.

**Print agent EXE:** `backend/public/downloads/*.exe` is gitignored. Deploy cross-compiles it with `pkg` (Docker `node:20-bookworm`) into that folder and Caddy proxies `/downloads/*` on `app.rebornsense.com` to the API (so the SPA never returns HTML as a fake `.exe`). Verify after deploy:

```bash
curl -sI https://app.rebornsense.com/downloads/reborn-print-agent-setup.exe
# 200 + application/octet-stream + ~40MB Content-Length
```

Skip rebuild: `SKIP_PRINT_AGENT_BUILD=1 bash scripts/deploy-hetzner.sh`

**Official login (everyone):** https://app.rebornsense.com/login

After sign-in the panel opens by role: superadmin → `/superadmin`, reseller → `/reseller`, merchant owner → `/merchant`, staff → merchant panel or WebPOS/waiter if that is their only permission.

**Read the current superadmin email/password from the server (do not guess):**

```bash
grep -E '^SEED_SUPERADMIN_' /root/chaslay-secrets/backend.env
```

**Reset superadmin password anytime:**

```bash
cd /root/FoodTruckPOS
bash scripts/set-superadmin-password.sh 'YourNewPassword123'
# or:
docker compose --env-file .env.production exec api npm run set-superadmin-password -- 'YourNewPassword123'
```

After changing `.env`, restart: `docker compose up -d --build`

---

## Merchant portal (shop owners)

Merchants log in at **https://app.rebornsense.com** with email + password.

**Create a merchant login** (superadmin ? Manage tenant ? Merchant portal login), or:

```bash
docker compose exec api npm run create-merchant-user -- \
  --tenantSlug=demo \
  --email=owner@shop.com \
  --password=ChangeMe123 \
  --name="Shop Owner"
```

Merchants can manage:
- Menu (categories & products) ? syncs to POS when online
- Online orders & status
- Opening hours, delivery zones, order settings

See `backend/ROADMAP.md` for the OrderPin-style agency roadmap (KDS, kiosk, table plan, etc.).

**Health check:** https://app.rebornsense.com/health

---

## 3. Create a merchant (client)

Each merchant gets a URL slug and their own POS API key:

```bash
docker compose exec api npm run create-tenant -- --slug=acme-burger --name="Acme Burger"
```

This prints:

- **POS API key** ? put in Android `SYNC_API_KEY`
- **Shop URL** ? `https://shop.rebornsense.com/acme-burger`

Demo tenant (after seed): https://shop.rebornsense.com/demo

---

## 4. Android app config

In `app/build.gradle.kts` (per merchant build):

```kotlin
buildConfigField("String", "LICENSE_API_BASE_URL", "\"https://app.rebornsense.com/\"")
buildConfigField("String", "TENANT_SLUG", "\"acme-burger\"")
buildConfigField("String", "SYNC_API_KEY", "\"PASTE_TENANT_API_KEY_FROM_CREATE-TENANT\"")
```

- `TENANT_SLUG` must match the merchant slug (license + sync scope).
- `SYNC_API_KEY` is the **per-tenant** key from `create-tenant`, not necessarily the global `API_KEY`.

Rebuild and install the APK.

---

## 5. License activation code

When the POS shows a **Device ID**:

```bash
docker compose exec api npm run generate-code -- --tenantSlug=acme-burger --deviceId=PASTE-UUID --days=365 --label="Acme Burger"
```

Send the printed code to the merchant.

---

## 6. How online shops work

- Public menu: `GET /v1/shop/{clientName}/menu`
- Place order: `POST /v1/shop/{clientName}/orders`
- Storefront page: `https://shop.rebornsense.com/{clientName}`

Orders appear in POS **Ongoing Orders** when the tablet is online and `SYNC_API_KEY` is set.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Activation fails | Check HTTPS, `LICENSE_API_BASE_URL`, and `TENANT_SLUG` matches merchant |
| Sync does nothing | Set tenant `SYNC_API_KEY` in app (from `create-tenant`) |
| Shop 404 | Run `create-tenant` or `seed`; slug must be lowercase `a-z`, `0-9`, hyphens |
| SSL not ready | Wait for DNS propagation; Caddy issues certs automatically |
| `ERR_SSL_PROTOCOL_ERROR` on Rebornsense | Wrong Caddyfile mounted (defaults to `Caddyfile.chaslay`). See [Rebornsense SSL fix](#rebornsense-ssl-err_ssl_protocol_error) below |
| `port is already allocated` (80/443) | Another Docker stack’s Caddy is still running. `docker ps --filter publish=80`; stop old compose (`docker compose down` in `/root/FoodTruckPOS` or project `foodtruckpos` / `backend`). Rebornsense: see [Port 80/443 already in use](#port-80443-already-in-use-rebornsense) |

---

## Optional later

- Stripe for online payment
- Full admin UI at `app.rebornsense.com`
- POS menu push to server
- Waiter / kiosk apps

## Custom domain (merchant shop)

Shop **slug** is enough: `https://shop.rebornsense.com/{slug}` (also `/shop/{slug}` on admin).

Shop **subdomain** (`https://{sub}.rebornsense.com`) is optional — it is **not** required for custom domains.

### DNS for a custom domain

Create a **CNAME** at your DNS provider:

| Field | Value |
|-------|--------|
| **Type** | `CNAME` |
| **Host / Name** | `www` (or `order`, `shop`, … — the hostname customers will use) |
| **Target / Value / Points to** | `shop.rebornsense.com` |

Then in Merchant → Settings (or Website CMS), enter the full hostname, e.g. `www.mycafe.ch`.

TLS certificates are issued automatically via on-demand TLS once DNS points at the platform and the domain is saved on the merchant.

