# Public downloads

Served by the API at `GET /downloads/<filename>` and proxied on `app.rebornsense.com` (Caddy → API, **not** the SPA).

Check availability without downloading the binary:

- `GET /downloads/reborn-print-bridge.json` — `{ available, version, downloadUrl }`
- `GET /downloads/reborn-print-agent.json` — Windows agent manifest

## RebornPOS (Windows NSIS installer)

`reborn-pos-setup.exe` is **gitignored** (~13MB). Built from `desktop/` (Tauri 2 kiosk shell).

### Build on Windows (local — required when GitHub Actions billing blocks `windows-latest`)

```powershell
# From repo root (Node 20+, Rust MSVC, WebView2):
powershell -ExecutionPolicy Bypass -File scripts/build-reborn-pos-windows.ps1

# Build + publish to app.rebornsense.com/downloads:
powershell -ExecutionPolicy Bypass -File scripts/build-reborn-pos-windows.ps1 -Publish
```

Requires `~/.reborn-agent-env` or SSH config alias `production-reborn` for publish.

### Publish an existing local build (Linux/macOS/WSL)

```bash
REBORN_POS_FETCH=0 bash scripts/publish-reborn-pos-download.sh
```

### Verify

```bash
curl -sL https://app.rebornsense.com/downloads/reborn-pos-setup.json
curl -sI https://app.rebornsense.com/downloads/reborn-pos-setup.exe
# Expect: 200, >1MB, magic MZ
```

Public URL: `https://app.rebornsense.com/downloads/reborn-pos-setup.exe`

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

### Signing (in-place upgrades)

All official APKs must be signed with the **same** release keystore. Ephemeral debug keystores (default local/Docker builds) cause `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on tablets that already have Bridge installed.

See `print-agent-android/BRIDGE_APK_SIGNING.md`.

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
