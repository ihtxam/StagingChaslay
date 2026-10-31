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

## POS-only (not ported to Bridge)

- In-app Settings scale picker UI (Bridge uses WebPOS config + `/scale/ports`).
- POS `UsbPrinterManager` inline print permission queue callbacks (Bridge uses `UsbPermissionReceiver` + `UsbPlugPlay`).
