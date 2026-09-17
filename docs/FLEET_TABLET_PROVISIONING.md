# Fleet tablet provisioning (Bridge Reborn kiosk mode)

Bridge Reborn **0.6.0+** can run as **Android device owner** on dedicated POS tablets. In fleet kiosk mode:

- Bridge foreground service starts on **every boot** (alarm watchdog + boot receiver).
- **WebPOS opens automatically** in Chrome (or the detected browser).
- **Lock task** prevents staff from leaving POS or force-stopping Bridge from Recents.
- Resellers exit kiosk with the **admin PIN** (default `0000`, change in Fleet kiosk setup).

Bridge stays the print + Tap to Pay layer; WebPOS remains the POS UI in the browser.

---

## Architecture

```
Boot → Bridge FGS (:9101) → Chrome lock task → WebPOS (/merchant/pos)
                ↑
         Device owner policies (Bridge APK)
```

---

## One-time provisioning (per tablet)

Device owner can only be set on a **fresh or factory-reset** device **before** a personal Google account is added (or via Android Enterprise zero-touch / QR — see below).

### Steps (ADB — lab / reseller bench)

1. Factory reset the tablet (or use a new device).
2. Complete Android setup **without** adding a Google account (skip Wi‑Fi sign-in if possible, or use guest mode).
3. Enable **Developer options → USB debugging**.
4. Install Bridge Reborn APK (from merchant panel or `adb install`).
5. Run (replace package if you use a fork):

```bash
adb shell dpm set-device-owner com.rebornsense.printbridge/.fleet.PrintBridgeDeviceAdminReceiver
```

Expected output: `Success: Device owner set to package …`

6. Open **Bridge Reborn → Fleet kiosk setup**:
   - Confirm **Device owner: Active**
   - Set **admin PIN** (not the default in production)
   - Optional: **WebPOS URL** override (defaults to origin synced from WebPOS `/config`)
   - Enable **POS kiosk mode**
   - Tap **Launch kiosk now**

7. Reboot once to verify WebPOS opens automatically and printing works.

### Troubleshooting `dpm set-device-owner`

| Error | Fix |
|-------|-----|
| `Not allowed to set the device owner because there are already some accounts on the device` | Factory reset; do not add Google account before provisioning |
| `Not allowed to set the device owner because there are already several users` | Remove secondary users / reset |
| `Trying to set the device owner on a device with no accounts` but still fails | Uninstall other MDM/DPC apps; reboot |
| `Component not found` | Reinstall Bridge 0.6.0+ APK; check component path |

---

## Android Enterprise (recommended at scale)

For 10+ tablets, use **zero-touch enrollment** or a **QR provisioning** payload that sets Bridge as device owner during setup.

High-level flow:

1. Register devices in [Android Enterprise](https://support.google.com/work/android/answer/7049084) (reseller / EMM).
2. Build a managed provisioning JSON with:
   - `android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME` = `com.rebornsense.printbridge/.fleet.PrintBridgeDeviceAdminReceiver`
   - `android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION` = signed APK URL (`https://app.chaslay.com/downloads/reborn-print-bridge.apk`)
3. Scan QR on factory-reset devices.

Contact Reborn support for a managed Play private app track if you cannot host the APK URL.

---

## Sunmi / Feitian fleet notes

| OEM | Notes |
|-----|--------|
| **Sunmi** | Sunmi TMS can push APK + kiosk; device-owner ADB still works on D2/D3 when not locked by Sunmi MDM |
| **Feitian F310A** | Install Chrome; OTG printers via Bridge as today |
| **Generic** | Chrome required; install from Play before enabling kiosk |

When device owner is active, the OEM setup wizard **skips** manual battery/autostart steps — policies are applied programmatically.

---

## Exiting kiosk (support / manager)

1. Tap the **Bridge Reborn** persistent notification → **Fleet kiosk setup**
2. Tap **Exit kiosk (admin PIN)** and enter the PIN
3. Or disable **POS kiosk mode** switch

---

## Health check

`GET http://127.0.0.1:9101/health` includes:

```json
{
  "deviceOwner": true,
  "kioskEnabled": true,
  "kioskActive": true
}
```

Use this in fleet monitoring scripts.

---

## Security

- Change the default admin PIN (`0000`) before handing tablets to stores.
- Device owner is powerful — only provision tablets you fully control.
- Rotate Adyen / merchant credentials separately; kiosk mode does not replace merchant auth in WebPOS.
