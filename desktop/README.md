# Chaslay POS — Windows Tauri shell (Phase A)

This is a **kiosk window** around the hosted WebPOS. It is not a second POS.

- **UI:** existing dashboard at `/merchant/pos` (hosted URL)
- **Hardware:** existing Print Agent on `http://127.0.0.1:9101` (sidecar comes in Phase C)
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

# Terminal 2 — kiosk (loads http://127.0.0.1:5173/login in debug)
cd desktop
npm install
$env:CHASLAY_POS_URL = "http://127.0.0.1:5173/login"
npm run dev
```

## Production installer

```powershell
cd desktop
npm install
# optional: $env:CHASLAY_POS_URL = "https://app.chaslay.com/login"
npm run build:nsis
# Output: src-tauri/target/release/bundle/nsis/
```

CI also builds on every `main` push that touches `desktop/` — see `.github/workflows/build-chaslay-pos-windows.yml`. Download the `chaslay-pos-windows-*` artifact from GitHub Actions (NSIS `.exe`, ~5–15 MB).

Release builds open `https://app.chaslay.com/login` unless `CHASLAY_POS_URL` is set at compile/runtime.

## Behaviour

| Feature | Phase A |
|---------|---------|
| Fullscreen, no browser chrome | Yes |
| Single instance | Yes |
| Autostart toggle (`set_start_with_windows`) | Yes (not forced on) |
| Navigation locked to chaslay.com / rebornsense.com / localhost | Yes |
| Print Agent bundled | **No** — install existing EXE until Phase C |
| Auto-update | Phase F |

## Staging

Point the shell at staging:

```powershell
$env:CHASLAY_POS_URL = "https://app.chaslay.com/login"
```
