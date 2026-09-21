# Chaslay POS — Windows Tauri shell (Phase A–D)

Kiosk window around hosted WebPOS — not a second POS.

- **UI:** existing dashboard at `/merchant/pos` (hosted URL)
- **Hardware:** Print Agent sidecar on `http://127.0.0.1:9101` (Phase C)
- **Native bridge:** `window.manuposDesktop` via Tauri commands → sidecar (Phase D start)
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
# Build Print Agent EXE first (bundled as sidecar)
cd print-agent
npm install
npm run build:exe
Copy-Item dist/reborn-print-agent.exe ../desktop/src-tauri/binaries/reborn-print-agent-x86_64-pc-windows-msvc.exe

cd ../desktop
npm install
# Add to tauri.conf.json bundle.externalBin: ["binaries/reborn-print-agent"]
# optional: $env:CHASLAY_POS_URL = "https://app.chaslay.com/login"
npm run build:nsis
# Output: src-tauri/target/release/bundle/nsis/
```

CI also builds on every `main` push that touches `desktop/` — see `.github/workflows/build-chaslay-pos-windows.yml`.

Release builds open `https://app.chaslay.com/login` unless `CHASLAY_POS_URL` is set at compile/runtime.

## Behaviour

| Feature | Status |
|---------|--------|
| Maximized kiosk, no browser chrome | Yes |
| Desktop top bar (refresh / window / settings) | Yes |
| ESC does not trap user (no OS fullscreen) | Yes |
| Single instance | Yes |
| Autostart toggle (`set_start_with_windows`) | Yes |
| Navigation locked to chaslay.com / rebornsense.com / localhost | Yes |
| Print Agent sidecar auto-start + `/sidecar_health` | Phase C |
| `hw_*` Tauri commands → sidecar HTTP | Phase D start |
| Auto-update | Phase F |

## Sidecar

The NSIS bundle includes `reborn-print-agent.exe` when `print-agent/dist/reborn-print-agent.exe` exists at build time. On startup Tauri:

1. Probes `GET http://127.0.0.1:9101/health`
2. Spawns bundled sidecar or `%LOCALAPPDATA%\RebornPrintAgent\reborn-print-agent.exe` if needed
3. Exposes health via `sidecar_health` command

Merchants on Tauri tills can skip the separate “Download Print Agent” step once the sidecar is bundled.

## Staging

```powershell
$env:CHASLAY_POS_URL = "https://app.chaslay.com/login"
```
