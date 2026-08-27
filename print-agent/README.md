# Reborn Print Agent (Windows)

Local HTTP service (`http://127.0.0.1:9101`) used by WebPOS for silent ESC/POS RAW printing and USB/Bluetooth scale reads.

## Install once (recommended)

1. Download **Reborn Print Agent** from the merchant dashboard:
   - **Settings ? Receipts & printers ? Download Reborn Print Agent**
   - Or open: `https://app.rebornsense.com/downloads/chaslayreborn-print-agent-setup.exe`
     (same file via `https://api.rebornsense.com/downloads/...`)
2. Run the setup EXE once.
3. It installs to `%LOCALAPPDATA%\ChaslayPrintAgent\` (same folder as older installs), registers **Windows Startup**, and starts the agent.

The setup dialog title is **Reborn Print Agent**. The install folder name is unchanged so existing PCs keep working.

```bat
chaslayreborn-print-agent-setup.exe
REM or:
chaslay-print-agent.exe --install
chaslay-print-agent.exe --uninstall
```

## Device names vs COM ports

USB scales (CH340 / ?CH 43?) and Bluetooth COM printers often get a **new COM number** after each plug-in or Windows restart.

- **Scale:** Settings ? Print ? Scan scale lists the manufacturer/model (for example `USB-SERIAL CH340 ? COM7`). That name is saved. On the next sale the agent finds the current COM port from the name.
- **Printer:** Pick the Windows printer by its real name. The agent ignores changing `(COMx)` suffixes when printing.

Reinstall the agent after this update (v1.7.0+) so those lookups work.

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
| `dist/chaslay-print-agent.exe` | Runtime agent |
| `dist/chaslayreborn-print-agent-setup.exe` | Same binary; double-click installs + auto-start |
| `backend/public/downloads/chaslayreborn-print-agent-setup.exe` | Served by API at `/downloads/...` (gitignored; deploy rebuilds) |

**Deploy note:** EXEs are not in git. `scripts/deploy-hetzner.sh` cross-compiles with `pkg` and bind-mounts `backend/public/downloads` into the API container. See `backend/public/downloads/README.md`.

### How packaging works

- Uses [`pkg`](https://github.com/vercel/pkg) to bundle Node + `server.js` into a single Windows x64 EXE.
- `win-raw-print.ps1` is embedded and extracted next to the installed EXE.
- `--install` copies files to `%LOCALAPPDATA%\ChaslayPrintAgent` and adds a `HKCU\...\Run` startup entry.
- Setup filename containing `setup` triggers install-on-launch automatically.

## Limitations

- **Windows only** (RAW Win32 print API).
- EXE is **unsigned** unless you codesign it (SmartScreen may warn).
- Binds to `127.0.0.1` only ? not exposed on the LAN.
- Not a Windows Service by default (per-user Startup is enough for WebPOS on the cashier PC). To run as a service, wrap the installed EXE with NSSM or Task Scheduler (SYSTEM).
- **OneNote / Microsoft Print to PDF / XPS** are rejected for RAW ESC/POS (they cannot render receipt bytes). Use a thermal receipt printer.
- Printer names with accents (e.g. French *Protégé*) are passed via a UTF-8 file to `OpenPrinterW` so they are not mangled to `?`.

### Install UX

- Setup EXE shows a **MessageBox** on success or failure, then exits (no CMD window left open).
- If a previous agent is running, setup stops it first so the EXE can be updated (avoids `EBUSY`).
- Log file: `%LOCALAPPDATA%\ChaslayPrintAgent\install.log`

**If you still see `EBUSY`:** Task Manager ? end `chaslay-print-agent.exe` ? run setup once more.

## API

- `GET /health`
- `GET /printers`
- `POST /print` `{ printerName?, dataBase64 }`
- `POST /drawer` `{ printerName? }`
