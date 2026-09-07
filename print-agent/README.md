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
- **Printer:** Pick the Windows printer by its real name. Bluetooth / virtual-COM (SPP) queues are paced automatically so multi-item kitchen tickets do not overflow the radio buffer. USB ESC/POS (USB001 / USBPRINT) is unpaced — Print Agent 1.10.3+ returns as soon as WritePrinter finishes instead of sleeping ~4–5s (`drainMs` + cut trailer) that used to apply to any queue named thermal/receipt/xprinter.

Reinstall the agent after this update (v1.9.2+) so Bluetooth / COM kitchen tickets stay paced and cut.

## Niimbot / Niimbus labels

Niimbot is **not ESC/POS**. Labels go to `POST /print/niimbot-label`. A beep + paper feed with no ink usually means:

1. The till is still on Print Agent older than 1.10.12, or
2. The job used the K3 4-byte / 384-dot layout. 1.10.10 padded 320-wide labels to 48-byte rows (`dim=00a00180`) and still printed blank on USB005. **1.10.11+ defaults USB "NIIMBOT K3" to official B21**: 2-byte `START_PRINT` `[0,1]`, 6-byte `SET_DIMENSION` height/width/copies, row width matching dim (320 ? `rowBytes=40` `dim=00a001400001`). USBPRINT sends the whole job as **one RAW document** (no 96-byte split, no ESC/POS cut).

**Till fix:** reinstall Print Agent 1.10.12. Settings ? Receipts & printers ? **Test bars (B21)** toasts `path`, `profile`, `inkBytes`, `rowBytes`, `dim`. Expect `path=usb:USB005` when USB005 is selected (Bluetooth COM6 is not Open()'d first). Expect `profil=b21` · `rowBytes=40` · `dim=00a001400001`. **Test bars (inverted)** sends the same job with bits flipped (`profil=b21+invert`). Pick **COM6** (Bluetooth) from the dropdown to force serial — Open() tries `COM6` and `\\.\COM6` at 115200/9600/19200 and toasts the real .NET exception (close NIIMBOT.exe on Access denied). `inkBytes=0` means empty bitmap.

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
