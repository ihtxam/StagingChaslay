# Self-hosted GitHub Actions runner on Hetzner (Rebornsense)

Use this when GitHub-hosted runners hit **minutes/concurrency** limits, or you want Bridge APK builds closer to production (`app.rebornsense.com`).

**Artifact storage quota** is separate: only fixed by deleting old artifacts, lowering `retention-days`, skipping `upload-artifact`, or buying more storage. See [GITHUB_ACTIONS_ARTIFACTS.md](./GITHUB_ACTIONS_ARTIFACTS.md).

## When to use which runner

| Goal | Runner |
|------|--------|
| Default Bridge CI + SCP to production | `ubuntu-latest` (workflow already SCPs APK; no artifacts) |
| Build on your Hetzner box (more disk, cached SDK) | `self-hosted` label on that server |
| Full production deploy | Still `Deploy to Rebornsense` workflow; runner only builds Bridge |

You can register the **same** Hetzner VPS that hosts production, or a **separate** build VM. If the runner is the production host, SCP still works (copy into `/root/rebornSense/backend/public/downloads/`).

## 1. Prepare the server (Ubuntu 22.04+)

SSH as root or a deploy user with sudo.

```bash
apt-get update
apt-get install -y curl git jq unzip openjdk-17-jdk

# Android SDK (for self-hosted Bridge builds)
export ANDROID_HOME=/opt/android-sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd /tmp
curl -fsSLO https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q commandlinetools-linux-*_latest.zip -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

# Persist for the runner service user (replace `runner` with your user)
grep -q ANDROID_HOME /etc/environment || cat >> /etc/environment <<'EOF'
ANDROID_HOME=/opt/android-sdk
ANDROID_SDK_ROOT=/opt/android-sdk
EOF
```

Optional: copy production Bridge keystore to the runner (same as deploy):

```bash
# On production: /root/rebornSense/.secrets/bridge-release.keystore
# Set GitHub secrets BRIDGE_KEYSTORE_* instead if you prefer not to store on disk.
```

## 2. Create a dedicated user (recommended)

```bash
useradd -m -s /bin/bash github-runner
usermod -aG docker github-runner   # only if you need docker for other jobs
```

## 3. Register the runner with GitHub

1. GitHub → **ihtxam/rebornSense** → **Settings** → **Actions** → **Runners** → **New self-hosted runner**.
2. Choose **Linux** / **x64**.
3. On the Hetzner server (as `github-runner`):

```bash
sudo -u github-runner -i
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64-2.321.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
# Use the exact URL/version shown in the GitHub UI if newer.
tar xzf ./actions-runner-linux-x64-*.tar.gz
./config.sh --url https://github.com/ihtxam/rebornSense --token <TOKEN_FROM_GITHUB_UI>
```

Suggested labels when prompted (or add later):

- `self-hosted`
- `linux`
- `reborn` (production Hetzner box — same host as `production-reborn` SSH alias)
- `hetzner` (optional alias)
- `bridge` (optional, pin Android Bridge jobs only)

## 4. Install and start the runner service

```bash
sudo ./svc.sh install github-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

Firewall: runner only needs **outbound** HTTPS to GitHub; no inbound ports required.

## 5. Repository secrets (already used by SCP deploy)

Ensure these exist on **rebornSense** (not StagingChaslay):

| Secret | Example |
|--------|---------|
| `REBORN_HETZNER_HOST` | `91.98.41.165` |
| `REBORN_HETZNER_USER` | `root` |
| `REBORN_HETZNER_SSH_KEY` | private key allowed to SSH to production |
| `REBORN_HETZNER_DEPLOY_PATH` | `/root/rebornSense` |
| `BRIDGE_KEYSTORE_BASE64` | release keystore (recommended) |
| `BRIDGE_KEYSTORE_PASSWORD`, `BRIDGE_KEY_ALIAS`, `BRIDGE_KEY_PASSWORD` | signing |

## 6. Run Bridge workflow on self-hosted

**Actions** → **Build Bridge APK** → **Run workflow**:

- **runner**: `self-hosted`
- **deploy_production**: `true`

Or change default in `.github/workflows/build-bridge-apk.yml` to `runs-on: [self-hosted, linux, reborn]` once the runner is online.

Example for heavy Linux jobs:

```yaml
jobs:
  build-apk:
    runs-on: [self-hosted, linux, reborn]
```

Windows NSIS builds still need `windows-latest` or a **self-hosted Windows** machine with label `windows` (see `build-chaslay-pos-windows.yml`).

## 7. Maintenance

```bash
cd ~/actions-runner
sudo ./svc.sh stop
# ./config.sh remove  # to unregister
# Re-download runner package and ./config.sh when upgrading
sudo ./svc.sh start
```

Rotate the registration token if the runner is compromised. Prefer a **machine user** or org-level runner for multiple repos.

## Security notes

- Self-hosted runners execute **any** workflow from the repo (including PRs from forks if enabled). Restrict who can push workflows; use **Environment** protection rules for production deploy jobs if needed.
- Do not use production DB credentials on a shared runner unless the box is production-only and locked down.
