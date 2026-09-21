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

## Native vs sidecar hardware paths

| Operation | Primary | Fallback |
|-----------|---------|----------|
| List printers | Win32 via PowerShell (`hw_list_printers`) | Sidecar `GET /printers` |
| Raw ESC/POS print | `win-raw-print.ps1` bundled in resources | Sidecar `POST /print` |
| Cash drawer kick | Native ESC/POS pulse via `win-raw-print.ps1` | Sidecar `POST /drawer` |
| USB scale | Sidecar `GET /scale/ports`, `GET /scale/reading` | — |

The dashboard reads active paths via `hw_capabilities` (returns `native`, `sidecar`, or `auto`).
