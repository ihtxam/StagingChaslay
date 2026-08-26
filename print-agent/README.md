# Reborn Print Agent (Windows)

Local HTTP service (`http://127.0.0.1:9101`) used by WebPOS for silent ESC/POS RAW printing and USB/Bluetooth scale reads.

## Install once (recommended)

1. Download **Reborn Print Agent** from the merchant dashboard:
   - **Settings ? Receipts & printers ? Download Reborn Print Agent**
   - Or open: `https://app.rebornsense.com/downloads/chaslay-print-agent-setup.exe`
2. Run the setup EXE once.
3. It installs to `%LOCALAPPDATA%\ChaslayPrintAgent\` (same folder as older installs), registers **Windows Startup**, and starts the agent.

The setup dialog title is **Reborn Print Agent**. The install folder name is unchanged so existing PCs keep working.

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
