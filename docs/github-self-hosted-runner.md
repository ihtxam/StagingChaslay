# GitHub self-hosted runner + Cursor Cloud Agent workers

This guide explains how to stop **GitHub Actions billing, minutes, concurrency, and artifact quota** from blocking deploys and APK builds for **ihtxam/rebornSense**, and how that relates to **Cursor Cloud Agent** self-hosted machines (a separate product feature).

Detailed step-by-step for Hetzner/Linux is also in [.github/SELF_HOSTED_RUNNER_HETZNER.md](../.github/SELF_HOSTED_RUNNER_HETZNER.md). Artifact quota specifics: [.github/GITHUB_ACTIONS_ARTIFACTS.md](../.github/GITHUB_ACTIONS_ARTIFACTS.md). Production deploy without Actions: [DEPLOY.md](../DEPLOY.md) (webhook).

---

## Know what is blocking you

| Symptom | Cause | Self-hosted GitHub runner helps? |
|--------|--------|----------------------------------|
| “The job was not started because recent account payments have failed” / spending limit | **Billing / minutes** on GitHub-hosted runners | **Yes** — jobs on `self-hosted` do not consume GitHub-hosted minutes |
| “Artifact storage quota has been hit” | **`upload-artifact` storage** | **No** — unless you stop uploading artifacts (this repo already SCPs APKs; see artifacts doc) |
| `no space left on device` on Bridge builds | **Small GitHub-hosted disk** | **Yes** — your server can have a large disk and cached Android SDK |
| Production deploy blocked | **`deploy-rebornsense.yml` needs a runner** | **Yes**, or **prefer webhook deploy** (no runner at all) |

---

## Current workflows (`runs-on`)

| Workflow | Default runner | Self-hosted today |
|----------|----------------|-------------------|
| `deploy-rebornsense.yml` | `ubuntu-latest` | Not wired — change YAML or use webhook deploy |
| `build-bridge-apk.yml` | `ubuntu-latest` (push); manual dispatch can pick `self-hosted` | Partial — see workflow input `runner` |
| `build-chaslay-pos-apk.yml` | `ubuntu-latest` | Not wired |
| `build-chaslay-pos-windows.yml` | `windows-latest` | Comment only — use `[self-hosted, windows]` when registered |
| All other `.github/workflows/*` | Mostly `ubuntu-latest` | Optional for health/sync jobs |

After your Linux runner is online with labels `self-hosted`, `linux`, and e.g. `reborn`, pin heavy jobs:

```yaml
jobs:
  build-apk:
    runs-on: [self-hosted, linux, reborn]
```

Bridge workflow already supports manual self-hosted:

```yaml
# .github/workflows/build-bridge-apk.yml (existing pattern)
runs-on: ${{ github.event_name == 'workflow_dispatch' && inputs.runner == 'self-hosted' && 'self-hosted' || 'ubuntu-latest' }}
```

To always use your server on push, replace that expression with `[self-hosted, linux, reborn]` (or your custom labels).

Windows installer workflow:

```yaml
runs-on: [self-hosted, windows]   # after registering a Windows self-hosted runner
```

---

## 1. Install GitHub Actions runner (Linux server)

Use a **dedicated build VM** or your separate runner server — not required to be the production app host.

### Prepare Ubuntu 22.04+

See [.github/SELF_HOSTED_RUNNER_HETZNER.md](../.github/SELF_HOSTED_RUNNER_HETZNER.md) for JDK 17, Android SDK under `/opt/android-sdk`, and a `github-runner` user.

### Register to the repo

1. GitHub → **ihtxam/rebornSense** → **Settings** → **Actions** → **Runners** → **New self-hosted runner** → **Linux x64**.
2. On the server (as the runner user), run the **exact** commands and runner version shown in the UI (token is single-use; never commit it).

Suggested labels when configuring:

- `self-hosted` (required for `runs-on: self-hosted`)
- `linux`
- `reborn` or `hetzner` (custom pin for your box)
- `bridge` (optional — only Bridge APK jobs)

### Run as a service

```bash
sudo ./svc.sh install github-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

Outbound HTTPS to GitHub only; no inbound firewall rules.

### Org-level runner (optional)

For multiple repos, register under **Organization → Settings → Actions → Runners** and use group labels. Same security rules apply.

---

## 2. Repository secrets (unchanged)

Self-hosted jobs still read **GitHub Actions secrets** from the repo. Required for deploy/APK SCP paths include:

- `REBORN_HETZNER_HOST`, `REBORN_HETZNER_USER`, `REBORN_HETZNER_SSH_KEY`, `REBORN_HETZNER_DEPLOY_PATH`
- `ADYEN_SDK_*`, `BRIDGE_KEYSTORE_*` as documented in workflow comments

Do not put secrets in the runner filesystem unless you accept box-compromise risk; prefer GitHub encrypted secrets.

---

## 3. Security

- Self-hosted runners execute **workflow code from the repo** with access to secrets available to that workflow.
- **Fork PRs**: disable or restrict “Run workflows from fork pull requests” (**Settings → Actions**) unless you use approval gates — fork workflows on self-hosted runners are a common attack path.
- Use a dedicated **`github-runner`** OS user, not interactive root.
- For production deploy jobs, consider GitHub **Environments** with required reviewers so `deploy-rebornsense.yml` cannot run from arbitrary branches without approval.
- Rotate runner registration if the machine is compromised: `./config.sh remove`, revoke in GitHub UI, re-register.

---

## 4. Billing strategy

1. **Production deploy**: prefer **VPS webhook** (`scripts/install-deploy-webhook.sh`) — documented in [DEPLOY.md](../DEPLOY.md) — **zero** GitHub runner minutes.
2. **APK / Bridge CI**: move to **self-hosted Linux** for minutes and disk.
3. **Windows NSIS**: self-hosted Windows runner **or** local script `scripts/build-reborn-pos-windows.ps1 -Publish` when `windows-latest` is blocked.
4. **Artifacts**: run **Cleanup GitHub Actions artifacts** workflow or delete in UI; self-hosted does not help if something still calls `upload-artifact`.
5. Optional org policy: limit who can use GitHub-hosted runners and rely on self-hosted for private repo workflows only.

---

## 5. Cursor Cloud Agent — self-hosted **workers** (not GitHub runners)

These are **different** from GitHub Actions runners:

| | GitHub self-hosted runner | Cursor self-hosted worker |
|--|---------------------------|---------------------------|
| Purpose | Run `.github/workflows` jobs | Run **Cloud Agent** sessions on your hardware |
| Install | [actions/runner](https://github.com/actions/runner) | Cursor **agent worker** (`agent worker start` — see Cursor dashboard docs) |
| Labels | GitHub runner labels in `runs-on` | Cursor labels e.g. `repo`, `cursor.private_worker.os`, `name` |
| Billing | Avoids GitHub Actions minutes | Cursor plan / team pool — not GitHub |

### How Cloud Agents target workers

From Cursor’s cloud API (also exposed to agents via **cursor-cloud → list-self-hosted-workers**):

- Workers appear only while **`agent worker start`** is running and connected.
- Each worker has **`workerId`**, **`repos`**, **`labels`**, **`isInUse`**, **`sharedAssignmentAllowed`** (concurrent vs queued), and **`approved`** (whether this project may place agents there).
- **Team pools**: use **`pools`** in the API response — place runs with **`self_hosted_pool`** by **pool name**; check **`idleWorkerCount`** before targeting a busy pool.
- **Personal workers**: target by **`workerId`** (names are not unique across a team).
- If **`approved`** is false, request access for that machine in the Cursor dashboard before starting agents.

### rebornSense environment

Cloud Agent install/start for this repo is defined in [`.cursor/environment.json`](../.cursor/environment.json) (`install`, `start`, `terminals`). Link the repo environment in **Cursor → Dashboard → Cloud Agents → Environments**.

Example snapshot (your team may differ): connected workers may include **Windows** machines with label `cursor.private_worker.os=windows` and `repo=ihtxam/rebornSense`. There is **no substitute** for a **Linux GitHub runner** on that Windows box unless you also install the **GitHub Actions runner** on a Linux server.

### Co-locating both on one Linux server

You may run **GitHub Actions runner** and **Cursor agent worker** on the same machine with separate users/services. They do not share binaries; isolate secrets and disk (Android SDK vs Cloud Agent workspace).

---

## 6. Quick verification

**GitHub runner**

```bash
# On server
sudo ~/actions-runner/svc.sh status
```

GitHub → **Settings → Actions → Runners** should show **Idle** (green).

**Test Bridge on self-hosted**

Actions → **Build Bridge APK** → Run workflow → **runner: self-hosted** → **deploy_production: true**.

**Test deploy without billing**

```bash
# From a machine with gh auth — or use webhook / agent-deploy.sh
gh workflow run deploy-rebornsense.yml --ref main
# Or: bash scripts/agent-deploy.sh production  # if configured for webhook
```

---

## Related files

- [.github/SELF_HOSTED_RUNNER_HETZNER.md](../.github/SELF_HOSTED_RUNNER_HETZNER.md)
- [.github/GITHUB_ACTIONS_ARTIFACTS.md](../.github/GITHUB_ACTIONS_ARTIFACTS.md)
- [DEPLOY.md](../DEPLOY.md) — webhook production deploy
- `.github/workflows/build-bridge-apk.yml` — optional `self-hosted` dispatch input
