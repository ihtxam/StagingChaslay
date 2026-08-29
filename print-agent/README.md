# Reborn Print Agent (Windows)

Local HTTP service (`http://127.0.0.1:9101`) used by WebPOS for silent ESC/POS RAW printing and USB/Bluetooth scale reads.

## Install once (recommended)

1. Download **Reborn Print Agent** from the merchant dashboard:
   - **Settings ? Receipts & printers ? Download Reborn Print Agent**
   - Or open: `https://app.rebornsense.com/downloads/reborn-print-agent-setup.exe`
     (same file via `https://api.rebornsense.com/downloads/...`)
2. Run the setup EXE once.
3. It installs to `%LOCALAPPDATA%\RebornPrintAgent\` and registers **Windows Startup**.

```bat
reborn-print-agent-setup.exe
REM or:
reborn-print-agent.exe --install
reborn-print-agent.exe --uninstall
```

Older `chaslayreborn-*` download links redirect here. Setup migrates settings from `%LOCALAPPDATA%\ChaslayPrintAgent\` when present, then removes that folder.

## Device names vs COM ports

USB scales (CH340) and Bluetooth COM printers often get a **new COM number** after each plug-in or Windows restart.

- **Scale:** Settings ? Print ? Scan scale lists the manufacturer/model (for example `USB-SERIAL CH340 (COM7)`). That name is saved. On the next sale the agent finds the current COM port from the name.
- **Printer:** Pick the Windows printer by its real name. Bluetooth / virtual-COM (SPP) queues are paced automatically so multi-item kitchen tickets do not overflow the radio buffer.

Reinstall the agent after this update (v1.9.2+) so Bluetooth / COM kitchen tickets stay paced and cut.

## Dev (Node)

```bat
cd print-agent
npm install
npm start
```

## Build the installer EXE

Requires Node.js 18+ on Windows.

```powershell
cd print-agent
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

Outputs:

| File | Purpose |
|------|---------|
| `dist/reborn-print-agent.exe` | Runtime agent |
| `dist/reborn-print-agent-setup.exe` | Same binary; double-click installs + auto-start |
| `backend/public/downloads/reborn-print-agent-setup.exe` | Served by API at `/downloads/...` (gitignored; deploy rebuilds) |

**Deploy note:** EXEs are not in git. `scripts/deploy-hetzner.sh` cross-compiles with `pkg` and bind-mounts `backend/public/downloads` into the API container. See `backend/public/downloads/README.md`.

### How packaging works

- Uses [`pkg`](https://github.com/vercel/pkg) to bundle Node + `server.js` into a single Windows x64 EXE.
- `win-raw-print.ps1` is embedded and extracted next to the installed EXE.
- `--install` copies files to `%LOCALAPPDATA%\RebornPrintAgent` and adds a `HKCU\...\Run` startup entry.
- Setup filename containing `setup` triggers install-on-launch automatically.

## Limitations

- **Windows only** (RAW Win32 print API).
- EXE is **unsigned** unless you codesign it (SmartScreen may warn).
- Binds to `127.0.0.1` only — not exposed on the LAN.
- Not a Windows Service by default (per-user Startup is enough for WebPOS on the cashier PC). To run as a service, wrap the installed EXE with NSSM or Task Scheduler (SYSTEM).
- **OneNote / Microsoft Print to PDF / XPS** are rejected for RAW ESC/POS (they cannot render receipt bytes). Use a thermal receipt printer.
- Printer names with accents (e.g. French *Protégé*) are passed via a UTF-8 file to `OpenPrinterW` so they are not mangled to `?`.

### Install UX

- Setup EXE shows a **MessageBox** on success or failure, then exits (no CMD window left open).
- If a previous agent is running, setup stops it first so the EXE can be updated (avoids `EBUSY`).
- Log file: `%LOCALAPPDATA%\RebornPrintAgent\install.log`

**If you still see `EBUSY`:** Task Manager ? end `reborn-print-agent.exe` ? run setup once more.
