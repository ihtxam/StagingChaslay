# Public downloads

Served by the API at `GET /downloads/<filename>` and proxied on `app.rebornsense.com` (Caddy → API, **not** the SPA).

Check availability without downloading the binary:

- `GET /downloads/reborn-print-bridge.json` — `{ available, version, downloadUrl }`
- `GET /downloads/reborn-print-agent.json` — Windows agent manifest

## Print agent (Windows EXE)

`*.exe` files are **gitignored** (~40MB). They must be built and present on the server at:

`backend/public/downloads/reborn-print-agent-setup.exe`

### Build on Windows (local)

```powershell
cd print-agent
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

### Build on Hetzner (deploy)

`scripts/deploy-hetzner.sh` cross-compiles with `pkg` in a `node:20-bookworm` container.

Skip with `SKIP_PRINT_AGENT_BUILD=1` if you already uploaded a binary.

Legacy `chaslayreborn-*` URLs redirect to the Reborn filenames.

## Bridge Reborn (Android APK)

`reborn-print-bridge.apk` is **gitignored**. Built from `print-agent-android/`.

Served at `GET /downloads/reborn-print-bridge.apk`.

### Build locally

```bash
cd print-agent-android
./gradlew assembleRelease
# Gradle copies release APK → ../backend/public/downloads/reborn-print-bridge.apk
```

### Build on Hetzner (deploy)

`scripts/deploy-hetzner.sh` builds in `mingc/android-build-box` unless `SKIP_ANDROID_BRIDGE_BUILD=1`.

### Manual upload

```bash
scp backend/public/downloads/reborn-print-bridge.apk \
  root@YOUR_HOST:/root/rebornSense/backend/public/downloads/
docker compose --env-file .env.production up -d api caddy
```

### Verify

```bash
curl -sI https://app.rebornsense.com/downloads/reborn-print-bridge.apk
# Expect: 200, application/vnd.android.package-archive, >100KB, magic PK

curl -sL https://app.rebornsense.com/downloads/reborn-print-bridge.json
# available: true when APK is on the server

curl -sI https://app.rebornsense.com/downloads/reborn-print-agent-setup.exe
# Expect: 200, ~40MB, magic MZ
```

Public URLs:

- `https://app.rebornsense.com/downloads/reborn-print-bridge.apk`
- `https://app.rebornsense.com/downloads/reborn-print-agent-setup.exe`
