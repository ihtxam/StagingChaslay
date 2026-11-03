# USB host permissions — RebornPOS parity (Bridge)

Handoff notes for `print-agent-android` maintainers. Behavior matches **RebornPOS** (`app/…/printer/UsbPrinterManager.kt`, `UsbBootAttachGrace.kt`, `UsbAttachPromptGuard.kt`) adapted for WebPOS (HTTP service + optional Bridge UI).

## Goals

| Scenario | Expected behavior |
|----------|-------------------|
| **Reboot**, saved USB printer/scale still plugged in | **One** foreground allow dialog when Bridge `MainActivity` resumes (not every resume). Android often clears USB grant across reboot without a new `ATTACHED` broadcast. |
| **Reboot**, duplicate attach storms | Attach receiver **defers** prompts for **120s** after `BOOT_COMPLETED` (`UsbBootAttachGrace.GRACE_MS`). Post-boot foreground prompt handles the still-connected device. |
| **Replug** (unplug → plug) | Prompt again; **8s debounce** only for duplicate broadcasts for the **same** vid:pid (`UsbAttachPromptGuard`). **Clear debounce on DETACH** so replug is not suppressed. |
| **Unknown USB** | No auto prompt — only **default/remembered printer** (`PrinterPreferences`) or **monitored scale** (`ScalePreferences`, set when WebPOS calls `/scale/reading?usbAddress=…`). |
| **WebPOS print from service** | No dialog from background thread — `UsbPlugPlay` → notification or user-opened Bridge activity. |

## Bridge modules (source of truth)

| POS | Bridge |
|-----|--------|
| `UsbBootAttachGrace` | `usb/UsbBootAttachGrace.kt` (+ scale prompt keys) |
| `UsbAttachPromptGuard` | `usb/UsbAttachPromptGuard.kt` (+ Sunmi internal USB shadow skip) |
| `UsbPrinterManager` permission queue | `usb/UsbHostPermissions.kt` |
| Attach receiver | `usb/UsbAttachReceiver.kt` → `UsbPlugPlay.promptForMissingPrinter` / `promptForMissingScale` |
| Scale heuristics | `scale/ScaleUsbMatcher.kt` (ported from POS) |
| Scale monitored address | `scale/ScalePreferences.kt` |
| Boot anchor | `boot/BootCompletedReceiver.kt` + `PrintBridgeApplication` `ensureBootAnchorIfUnset` |

## Stable IDs

- Printers: `usb:VID:PID` only in prefs (no serial).
- Scale monitoring: same **vid:pid key** via `ScaleUsbHelper.permissionKey` (WebPOS may pass serial in query param; monitoring normalizes to vid:pid).

## Scale vs printer

- Printer attach: `UsbDeviceClassifier.shouldOfferUsbAccessOnAttach` + `shouldAutoRequestOnAttach`.
- Scale attach: `ScaleUsbMatcher` + `shouldAutoRequestScaleOnAttach` (requires prior `/scale/reading` or explicit `ScalePreferences.setMonitoredScaleAddress`).
- Independent **once-per-reboot** foreground prompts: `shouldOfferPostBootForegroundPrompt` vs `shouldOfferPostBootScaleForegroundPrompt`.

## Manual / explicit flows (unchanged intent)

- **Grant USB** in Bridge UI: `requestNextMissingPermission` — any attached printer candidate.
- **Test print**: waits for permission via `onPermissionSettled`.
- POS **Settings → Scale test** maps to Bridge **HTTP scale read** + notification prompt when permission missing.

## Regression checklist (tablet)

1. Reboot with saved USB printer — single allow on first Bridge foreground open; no prompt on second resume.
2. Reboot with scale address already used by WebPOS — single scale allow (if printer already granted, still one scale prompt when scale unauthorized).
3. Unplug printer, replug within 10s — allow dialog appears (debounce must not block replug).
4. Attach random USB barcode wedge — no Bridge notification.
5. Print from WebPOS without Bridge UI — notification tap opens allow flow.

## Bluetooth warmup (RebornPOS parity)

Native POS runs `PrinterConnectionManager.warmupOnStartup()` on app create: for each enabled printer it opens a short Bluetooth SPP session and closes it so the first ticket is not paying cold-connect latency.

Bridge mirrors this for the **default / saved Bluetooth receipt printer** (`PrinterPreferences.default_printer_id`, same routing as `/print`):

| Trigger | Bridge behavior |
|---------|-----------------|
| `PrintBridgeService` discovery after start (~2s delay) | `registry.refresh()` then background thread → `DriverRegistry.warmupDefaultBluetoothPrinter` → `BluetoothEscPosDriver.warmupConnection` (open SPP, close; no cached socket) |
| `ACTION_REFRESH_PRINTERS` | Same path via `discoverPrintersQuietly()` |
| Missing `BLUETOOTH_CONNECT` / `BLUETOOTH_SCAN` (API 31+) | Skipped with debug log; user must grant via Bridge UI first |
| Default printer is USB / Sunmi / LAN | Warmup skipped (BT-only) |

### Manual test (Bluetooth tablet)

1. Pair a receipt printer, set it as default in Bridge, grant BT permissions.
2. Force-stop Bridge, start service (boot autostart or open Bridge).
3. `adb logcat -s PrintBridgeService BluetoothEscPosDriver` — expect `BT warmup OK for <MAC>` within a few seconds of discovery.
4. Send first WebPOS receipt — should connect without the long first-print stall seen before warmup.
5. Revoke BT permission — warmup log shows `Skipping BT warmup — permissions not granted`; first print may prompt or fail until permission restored.

## POS-only (not ported to Bridge)

- In-app Settings scale picker UI (Bridge uses WebPOS config + `/scale/ports`).
- POS `UsbPrinterManager` inline print permission queue callbacks (Bridge uses `UsbPermissionReceiver` + `UsbPlugPlay`).
