# Public downloads

Served by the API at `GET /downloads/<filename>` and proxied on `app.rebornsense.com` (Caddy → API, **not** the SPA).

Check availability without downloading the binary:

- `GET /downloads/reborn-print-bridge.json` — Tap to Pay edition `{ available, version, downloadUrl }`
- `GET /downloads/reborn-print-bridge-print.json` — print-only edition manifest
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

Two editions share the same package id (`com.rebornsense.printbridge`) — installing one replaces the other on the tablet.

| Edition | File | Use case |
|---------|------|----------|
| **Print only** | `reborn-print-bridge-print.apk` | Kitchen / printer tablets — background printing only (~5 MB) |
| **Print + Tap to Pay** | `reborn-print-bridge.apk` | POS tablets with NFC card payments (~150 MB with Adyen SDK) |

Both APKs are **gitignored**. Built from `print-agent-android/` product flavors `print` and `tapToPay`.

### Build locally

```bash
cd print-agent-android
./gradlew assemblePrintRelease assembleTapToPayRelease
# Gradle copies release APKs → ../backend/public/downloads/
```

### Build on Hetzner (deploy)

`scripts/deploy-hetzner.sh` builds both flavors in `mingc/android-build-box` unless `SKIP_ANDROID_BRIDGE_BUILD=1`.

### Manual upload

```bash
scp backend/public/downloads/reborn-print-bridge*.apk \
  root@YOUR_HOST:/root/rebornSense/backend/public/downloads/
docker compose --env-file .env.production up -d api caddy
```

### Verify

```bash
curl -sI https://app.rebornsense.com/downloads/reborn-print-bridge.apk
curl -sI https://app.rebornsense.com/downloads/reborn-print-bridge-print.apk
# Expect: 200, application/vnd.android.package-archive, >100KB, magic PK

curl -sL https://app.rebornsense.com/downloads/reborn-print-bridge.json
curl -sL https://app.rebornsense.com/downloads/reborn-print-bridge-print.json
# available: true when APK is on the server

curl -sI https://app.rebornsense.com/downloads/reborn-print-agent-setup.exe
# Expect: 200, ~40MB, magic MZ
```

Public URLs:

- `https://app.rebornsense.com/downloads/reborn-print-bridge-print.apk` — print only
- `https://app.rebornsense.com/downloads/reborn-print-bridge.apk` — Tap to Pay
- `https://app.rebornsense.com/downloads/reborn-print-agent-setup.exe`
