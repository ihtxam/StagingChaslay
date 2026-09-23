# Chaslay POS — Windows Tauri shell (Phase A–D)

Kiosk window around hosted WebPOS — not a second POS.

- **UI:** existing dashboard at `/merchant/pos` (hosted URL)
- **Hardware:** native Win32 print/drawer when possible; Print Agent sidecar on `http://127.0.0.1:9101` as fallback
- **Native bridge:** `window.manuposDesktop` via Tauri commands → native or sidecar
- **Desktop settings:** `/merchant/desktop-settings` (Appearance, Printer, Scale, Cash Drawer, Device)
- **Offline:** existing IndexedDB outbox (no SQLite catalog)

See `/docs/windows-pos-tauri-plan.md`.

## Requirements (Windows builder)

- Rust (stable, MSVC)
- Node 20+
- WebView2 (bootstrapper is bundled)
- EV code-signing cert for production (unsigned = SmartScreen)

## Develop

```powershell
# Terminal 1 — dashboard
cd dashboard
npm run dev -- --host 127.0.0.1 --port 5173

# Terminal 2 — Print Agent (if not already installed)
cd print-agent
npm install
npm start

# Terminal 3 — kiosk (loads http://127.0.0.1:5173/login in debug)
cd desktop
npm install
$env:CHASLAY_POS_URL = "http://127.0.0.1:5173/login"
npm run dev
```

## Production installer

```powershell
# 1) Build Print Agent EXE (bundled as Tauri externalBin sidecar)
cd print-agent
npm install
npm run build:exe

# 2) Stage sidecar for Tauri bundle
New-Item -ItemType Directory -Force -Path ..\desktop\src-tauri\binaries | Out-Null
Copy-Item -Force dist\reborn-print-agent.exe ..\desktop\src-tauri\binaries\reborn-print-agent-x86_64-pc-windows-msvc.exe

# 3) Build NSIS installer (also copies win-raw-print.ps1 into resources)
cd ..\desktop
npm install
npm run build:nsis
# Output: src-tauri/target/release/bundle/nsis/
```

CI builds print-agent first, stages the sidecar, then runs `npm run build:nsis` — see `.github/workflows/build-chaslay-pos-windows.yml`.

Or run the all-in-one script on a Windows machine:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-reborn-pos-windows.ps1 -Publish
```

## Remote updates (Tauri updater)

RebornPOS checks `https://app.rebornsense.com/downloads/reborn-pos-update.json` on startup. When a newer signed build is published, merchants see a banner in the desktop chrome (“Restart to install”). The same `reborn-pos-setup.exe` URL is used for manual downloads and in-app updates.

### One-time signing key setup

Generate a minisign key pair (keep the private key secret):

```powershell
cd desktop
npx tauri signer generate -w $HOME\.tauri\reborn-pos.key --password ""
```

Configure GitHub Actions secrets on `ihtxam/rebornSense`:

| Secret | Value |
|--------|--------|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of the `.key` file (or base64-encoded key) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (empty string if none) |

The **public** key is committed in `desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. If you rotate keys, update the pubkey in config and regenerate all future builds with the new private key.

### Publish flow

1. Bump `version` in `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, and `desktop/src-tauri/tauri.conf.json`.
2. Merge to `main` — the Windows workflow builds, signs, writes `reborn-pos-update.json`, and SCPs to production downloads.
3. Installed clients download silently and prompt to restart.

Manual publish from a Windows build machine:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\reborn-pos.key -Raw
powershell -ExecutionPolicy Bypass -File scripts/build-reborn-pos-windows.ps1 -Publish
```

### Manual test (Windows)

1. Install an older RebornPOS build (e.g. 0.1.2) on a test PC.
2. Publish a newer signed build (0.1.3+) to production downloads.
3. Launch RebornPOS — confirm the update banner appears below the chrome bar.
4. Wait for “ready to install”, click **Restart to install** — app should relaunch on the new version (`Device` section in desktop settings shows version).

## Native vs sidecar hardware paths

| Operation | Primary | Fallback |
|-----------|---------|----------|
| List printers | Win32 via PowerShell (`hw_list_printers`) | Sidecar `GET /printers` |
| Raw ESC/POS print | `win-raw-print.ps1` bundled in resources | Sidecar `POST /print` |
| Cash drawer kick | Native ESC/POS pulse via `win-raw-print.ps1` | Sidecar `POST /drawer` |
| USB scale | Sidecar `GET /scale/ports`, `GET /scale/reading` | — |

The dashboard reads active paths via `hw_capabilities` (returns `native`, `sidecar`, or `auto`).
