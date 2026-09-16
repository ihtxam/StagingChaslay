# Reborn Print Agent (Windows)

Local HTTP service (`http://127.0.0.1:9101`) used by WebPOS for silent ESC/POS RAW printing and USB/Bluetooth scale reads.

## Install once (recommended)

1. Download **Reborn Print Agent** from the merchant dashboard:
   - **Settings -> Receipts & printers -> Download Reborn Print Agent**
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
- **Printer:** Pick the Windows printer by its real name. Bluetooth / virtual-COM (SPP) queues are paced automatically so multi-item kitchen tickets do not overflow the radio buffer. USB ESC/POS (USB001 / USBPRINT) is unpaced -- Print Agent 1.10.3+ returns as soon as WritePrinter finishes instead of sleeping ~4-5s (`drainMs` + cut trailer) that used to apply to any queue named thermal/receipt/xprinter.

Reinstall the agent after this update (v1.9.2+) so Bluetooth / COM kitchen tickets stay paced and cut.

## Niimbot label printers (K3 / B21 / D11 / B1)

Niimbot printers do not speak ESC/POS. They use a framed binary protocol
(`55 55 TYPE LEN DATA CSUM AA AA`) and are driven over one of three transports.
The transport matters more than the protocol variant, and getting it wrong looks
exactly like a protocol bug: the printer beeps, feeds a label, and prints nothing.

### Which transport actually works

| Transport | Works | Why |
|---|---|---|
| Serial port the queue is bound to (`COMx`, opened by the agent) | Yes | Bidirectional, and the agent chooses the baud rate. Agent 1.10.14+ reads `Win32_Printer.PortName` for the selected queue and takes this path whenever the queue is bound to a COM port. |
| USBPRINT device interface (`\\?\usb#...#{28d78fad-...}`) | Yes | Same bulk pipes as the spooler, but bidirectional and with no driver in the way. This is the Windows equivalent of `/dev/usb/lp0`, which is the transport [niimgo](https://github.com/MarkusOderSo/niimgo) requires for the K3. Agent 1.10.13+ prefers it over the spooler. |
| Bluetooth SPP (`COMx` outgoing port) | Yes | The transport [niimprint](https://github.com/AndBondStyle/niimprint) and [niimbluelib](https://github.com/MultiMote/niimbluelib) use. Bidirectional. |
| Android Print Bridge over Bluetooth | Yes | `print-agent-android` implements the same sequence niimgo uses, and reads the replies. |
| Windows print queue (`USBnnn` + `WritePrinter` RAW) | No | One-way only. The standard USB port monitor is not bidirectional, so the printer's acknowledgements never reach us -- and every Niimbot setup command expects one. A job can be accepted in full and still print nothing. |
| Windows print queue on a serial port (`COMx:` + `WritePrinter` RAW) | No | One-way, and worse: the spooler relays the bytes at the rate configured on that port in Windows, which defaults to **9600**. A Niimbot only speaks **115200**, so correct frames arrive as garbage. |

### The port the queue is bound to is the transport

`Win32_Printer.PortName` is the only authoritative answer to "where does this
queue print". The Ports dialog is not: a port can still be *associated* with a
queue (its name shown in the "Printer" column) while a different port is the
checked, active one.

One till cost eight days to this. `NIIMBOT K3` was bound to `COM8:` ("Port
série") while `USB005` was still listed against it, so every build up to 1.10.13
resolved `USB005`, or handed the job to the spooler. Either way the bytes never
reached the printer at a rate it could read, and the symptom -- beep, feed,
blank label -- was identical for every protocol variant we tried, which is what
made it look like a protocol bug for a week.

1.10.14 therefore picks the transport in this order:

1. a COM port the merchant selected explicitly,
2. the port `Win32_Printer.PortName` reports for that queue,
3. a USB spooler port (driven through the USBPRINT interface),
4. a COM port discovered only by name.

(4) never outranks (3), because CH340 scales share VID `1a86` and would
otherwise be mistaken for the printer. And a COM port that belongs to another,
non-Niimbot queue is refused outright: sending Niimbot frames to a receipt
printer only makes it beep.

No reference implementation prints a Niimbot through a print spooler. niimprint
ships exactly two transports, `BluetoothTransport` (an RFCOMM socket) and
`SerialTransport` (pyserial at 115200), and both implement `read()` as well as
`write()`; niimbluelib uses Web Bluetooth, Web Serial, BLE or node `serialport`;
niimgo uses `/dev/usb/lp*` or `/dev/ttyACM*`. For the K3 specifically, niimgo
states the Niimbot protocol only answers on the USB printer-class interface, not
on the K3's CDC-ACM serial interface -- and its troubleshooting section tells you
to *stop CUPS* before printing, because a spool queue owning the device is the
problem, not the solution.

The reason a queue cannot work is in the protocol table: only the raster row
commands (`0x83`, `0x84`, `0x85`, `0x8a`, `0x87`, `0xa7`) are one-way. Every
command that frames a job has a mandatory response -- `SetDensity 0x21 -> 0x31`,
`SetLabelType 0x23 -> 0x33`, `PrintStart 0x01 -> 0x02`, `PageStart 0x03 -> 0x04`,
`SetPageSize 0x13 -> 0x14`, `PageEnd 0xe3 -> 0xe4`, `PrintEnd 0xf3 -> 0xf4`. The
last one is decisive: `0xf4` returns `01` for "print finished (accepted)" and
`00` for "still printing", and niimprint loops on it
(`while not self.end_print()`). A write-only queue can never see `01`, so it can
never finish the documented sequence and can never tell you which step the
printer refused.

### Why not WinUSB / libusb

The `usb` npm package was assessed and rejected. `scripts/deploy-hetzner.sh`
cross-compiles the agent with `npx pkg . --targets node18-win-x64` inside a
**Linux** container, and `pkg` cannot compile native addons: it would need the
win32-x64 prebuilt `.node` fetched separately, added to `pkg.assets`, and
extracted to disk at startup before `require`. Even then libusb on Windows can
only claim a device that is bound to WinUSB, and a USB printer-class device is
owned by `usbprint.sys` -- so every till would need a manual Zadig driver swap
that also breaks the `USBnnn` queue and the vendor app.

Opening the USBPRINT device interface with `CreateFileW` reaches the same bulk
pipes, needs no native module, no driver swap and no new dependency, and still
builds with the existing `pkg` step.

### Protocol details that cause blank labels

- **Send nothing before the first `55 55` frame.** `0x54` is `RfidSuccessTimes`
  in the [protocol reference](https://printers.niim.blue/interfacing/proto/),
  not a wake command. Two unframed prologue bytes desynchronise the printer's
  frame parser.
- **Leave the three black-pixel-count bytes of `PrintBitmapRow` (0x85) at zero.**
  niimprint sets `counts = (0, 0, 0)` with the comment "It seems like you can
  always send zeros", and the chunked form depends on the exact printhead width.
- **A set bit is ink.** Rows are MSB-first, `ceil(width / 8)` bytes each, and
  `0x80` is the leftmost pixel.
- **`SetPageSize` (0x13) takes the row count first, then the column count**, and
  the column count must not exceed the printhead width.
- **Printhead width is per model:** K3 is 80 mm at 203 dpi = 640 dots; B21 / D11
  are 384.

### Diagnosing a blank label

**Settings -> Receipts & printers -> Diagnose Niimbot ports** is meant to be
enough on its own, with no follow-up questions. It reports:

- every print queue with its `PortName`, its driver, and whether that driver is
  missing (what Windows shows as *Pilote indisponible*),
- every COM port with its caption, PnP id, **the baud rate Windows has it
  configured at**, the print queue that owns it, and whether a Bluetooth port is
  the incoming (local RFCOMM server, unusable) or the outgoing one,
- each open attempt at 115200/9600/19200 with the real Windows exception,
- whether the USB printer-class interface can be opened directly,
- and one line: `RECOMMENDED PORT FOR NIIMBOT: COMx (bound to queue '...')`.

It is also available as `GET /print/niimbot-label/com-probe`, always returns 200,
and never throws.

### What a print result means

On the serial path the agent writes each command and reads the reply frame the
protocol owes it, then loops `PrintEnd` until `0xf4` answers `01`. Only that
answer is reported as a printed label. Anything else names the step the printer
refused, with the reply bytes, e.g.

```
Niimbot COM8 refused SetPageSize at 115200 baud: expected 0x14, answered 0xdb.
Raw bytes back: 5555db00dbaaaa. Replies so far: SetDensity=0x31:01, ...
```

If the printer answers but never confirms, the transport is right and the job
content is the problem. If it answers nothing at all, the port is wrong -- and
the agent does not fall back to the spooler for a COM-bound queue, because that
would only repeat the write at the wrong baud rate.

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
- Binds to `127.0.0.1` only -- not exposed on the LAN.
- Not a Windows Service by default (per-user Startup is enough for WebPOS on the cashier PC). To run as a service, wrap the installed EXE with NSSM or Task Scheduler (SYSTEM).
- **OneNote / Microsoft Print to PDF / XPS** are rejected for RAW ESC/POS (they cannot render receipt bytes). Use a thermal receipt printer.
- Printer names with accents (e.g. French *Protege*) are passed via a UTF-8 file to `OpenPrinterW` so they are not mangled to `?`.

### Install UX

- Setup EXE shows a **MessageBox** on success or failure, then exits (no CMD window left open).
- If a previous agent is running, setup stops it first so the EXE can be updated (avoids `EBUSY`).
- Log file: `%LOCALAPPDATA%\RebornPrintAgent\install.log`

**If you still see `EBUSY`:** Task Manager ? end `reborn-print-agent.exe` ? run setup once more.
