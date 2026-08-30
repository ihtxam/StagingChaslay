# Bridge Reborn (Android)

Companion app for **WebPOS in Chrome** on Android tablets and handhelds — not a POS app.  
WebPOS stays 100% in Chrome/PWA; Bridge Reborn is the local **print + NFC tap-to-pay** layer (same role as Windows Print Agent for printing).

## Problem

Browsers on Android cannot:
- Send ESC/POS bytes to Bluetooth, USB, or LAN printers
- Access NFC for EMV Tap to Pay (Adyen SoftPOS requires a native SDK)

Merchants use **one device only** (tablet or handheld) — no Windows hub PC.

## Solution

A small **always-on foreground service** on the device:

```
WebPOS (Chrome/PWA)  →  http://127.0.0.1:9101  →  Bridge Reborn  →  printer / NFC
```

**Same HTTP contract as Windows Print Agent** for printing — plus `/tap-to-pay` when the APK is built with Adyen SDK keys.

---

## Tap to Pay (NFC) — v0.3.0+

When the merchant has Adyen configured and the tablet has NFC:

| Endpoint | Method | Body / response |
|----------|--------|-----------------|
| `/health` | GET | Adds `nfcAvailable`, `tapToPayReady`, `tapToPayMessage` |
| `/tap-to-pay` | POST | `{ amount_minor, currency, api_base_url, auth_token, reference? }` → `{ ok, status, reference, message }` |

WebPOS passes the dashboard JWT from `localStorage`; the bridge calls `/api/tap-to-pay/*` on your backend.

**Build with Adyen:** set `adyenSdkApiKey` in repo-root `local.properties` (see `local.properties.example`). Without keys, printing still works; tap-to-pay returns a clear error.

**Plug-and-play flow:**
1. Install Bridge Reborn APK from Settings
2. Open once so Tap to Pay launcher registers
3. Open WebPOS in Chrome — Card payments automatically use NFC when Bridge Reborn reports `tapToPayReady`

---


## Supported hardware (Reborn stock & roadmap)

We do **not** assume Sunmi-only. The bridge uses a **pluggable driver** model and auto-detects what is available on each device.

| Device | Type | Built-in printer | USB host | Typical external printer |
|--------|------|------------------|----------|-------------------------|
| **Sunmi D3 Mini** | 10.1″ counter | ✅ 58 mm or 80 mm thermal | ✅ 3× USB 3.0 Type-A | USB receipt / kitchen on Type-A ports |
| **Sunmi D2s Plus** | Desktop terminal | ✅ 80 mm thermal | ✅ (peripheral ports) | USB or LAN |
| **Feitian F310A** | 6.5″ handheld | ❌ (base unit) | ✅ Type-C OTG | BT printer, F310-1 print module, USB thermal |
| **Feitian F310 + modules** | Modular | Optional F310-1 / F310-18 | ✅ | Module via pogo pin + SDK |
| **Generic Android tablets** | 15″ and custom | ❌ usually | ✅ OTG (varies) | BT, USB, or Wi‑Fi LAN |

### Driver matrix

| Driver | When used | Devices |
|--------|-----------|---------|
| `SunmiInternalDriver` | Sunmi PrinterService detected | D3 Mini, D2s Plus, other Sunmi |
| `UsbEscPosDriver` | USB thermal printer attached | **All** — D3 Mini Type-A, OTG handhelds, generic tablets |
| `BluetoothEscPosDriver` | Paired SPP ESC/POS printer | F310A, tablets without USB path |
| `NetworkRawDriver` | TCP :9100 on LAN | Counter setups with Ethernet/Wi‑Fi printers |
| `FeitianModuleDriver` | F310 print module attached (future) | F310A + F310-1 / F310-18 |

On setup, the wizard lists **every printer the drivers find** and merchant picks defaults per role (receipt / kitchen / labels).

---

## API contract (must match Windows agent)

| Endpoint | Method | Body / response |
|----------|--------|-----------------|
| `/health` | GET | `{ ok, version, platform: "android", deviceProfile, features, printerReady, queueDepth }` |
| `/printers` | GET | `{ printers: [{ name, isDefault?, connectionType, driver }] }` |
| `/print` | POST | `{ printerName?, dataBase64 }` → `{ ok, printer, queued? }` |
| `/drawer` | POST | `{ printerName? }` — cash drawer kick |

`connectionType`: `sunmi-internal` | `usb` | `bluetooth` | `lan`

Bind **127.0.0.1:9101** only (not LAN-exposed).

Optional later: `/scale/reading` for USB serial scales (Aclas on OTG / RJ11 adapters).

**Implemented in Bridge 0.3.4+:** `GET /scale/ports` lists USB scale devices; `GET /scale/reading?usbAddress=usb:VID:PID&timeoutMs=1200` returns live Aclas weight for WebPOS.

---

## Printer connections (priority for development)

### P1 — Sunmi built-in (stock devices: D3 Mini, D2s Plus)

- Sunmi Printer Interface Library (`com.sunmi:printerlibrary`) or AIDL `woyou.aidlservice.jiuiv5`
- Accepts ESC/POS byte stream via buffer API
- D3 Mini: 58 mm or 80 mm variant — auto-detect paper width in `/health`

### P1 — USB ESC/POS (required — same phase as Sunmi)

**Merchants need USB**, not only built-in print.

- `UsbManager` + `UsbDeviceConnection` bulk transfer
- Common USB thermal chips: Prolific, CH340, Epson USB class
- **Sunmi D3 Mini**: printers on rear **USB 3.0 Type-A** ports (host mode — ideal for kitchen printer on USB)
- **Handheld / generic**: USB-C OTG adapter → USB thermal
- Persist permission per device VID/PID; re-request only when device changes
- Hot-plug: `ACTION_USB_DEVICE_ATTACHED` → rescan `/printers`

### P2 — Bluetooth ESC/POS (SPP)

Classic Bluetooth serial (`00001101-0000-1000-8000-00805F9B34FB`).

- Primary path for **Feitian F310A** without print module
- Pair once → saved profile; auto-reconnect on drop
- Chunk jobs 4–8 KB

### P3 — LAN / Wi‑Fi RAW (TCP 9100)

- Fixed IP or mDNS (`_pdl-datastream._tcp`)
- D3 Mini has **RJ45 LAN** — kitchen printer on Ethernet is common

### P4 — Feitian print module (F310-1 / F310-18)

- Detect module via Feitian SDK or USB/BT endpoint when attached to F310A
- Ship after core USB/BT stable

---

## Device detection (`deviceProfile` in `/health`)

```json
{
  "ok": true,
  "platform": "android",
  "deviceProfile": "sunmi-d3-mini",
  "manufacturer": "SUNMI",
  "model": "D3 MINI",
  "features": ["sunmi-internal", "usb-host", "bluetooth", "lan", "queue", "drawer"]
}
```

Profiles we recognise:

- `sunmi-d3-mini`
- `sunmi-d2s-plus`
- `feitian-f310a`
- `generic-android`

Detection: `Build.MANUFACTURER` / `Build.MODEL` + capability probes (Sunmi service bind, USB host, etc.).

---

## Reliability design (foolproof)

### 1. Foreground service + persistent notification

- `START_STICKY`, `BOOT_COMPLETED`, merchant opt-in “Start with device”
- Works on Sunmi, Feitian, and generic OEMs

### 2. Local print queue (never lose a ticket)

```
WebPOS POST /print  →  Room DB queue  →  worker  →  driver  →  ack / retry
```

- Retries: 1s → 2s → 5s → 10s → 30s (max 10)
- USB unplugged / BT drop: job stays queued until printer returns

### 3. Connection watchdog

- Per-driver health check every 30s
- USB: re-enumerate on attach/detach
- BT: reconnect socket before next job
- `/health.printerReady` for WebPOS status bar

### 4. OEM battery / autostart wizard

Tailored steps per profile:

| OEM | Extra step |
|-----|------------|
| Sunmi | Sunmi autostart whitelist |
| Feitian | Background activity allow |
| Generic Chinese tablets | Battery “unrestricted” + locked recent apps |

### 5. Setup wizard

1. Install APK from panel
2. Grants: notifications, Bluetooth (nearby devices), USB
3. Scan printers (internal + USB + BT + LAN)
4. Assign **receipt** and **kitchen** default
5. Test print each
6. Open WebPOS

### 6. WebPOS integration

- `dashboard/src/lib/print-agent.ts` → `localhost:9101`
- Android single-device: local print only, no cloud hub relay
- Settings → **Download Bridge Reborn (Android)**

---

## Distribution

| Channel | Path |
|---------|------|
| Merchant panel | Settings → Receipts & printers |
| API | `GET /downloads/reborn-print-bridge.apk` |
| Deploy | `backend/public/downloads/` (build in CI) |

One **universal APK** for all devices (Sunmi, Feitian, generic). Drivers load at runtime based on detection.

---

## Troubleshooting (live testing)

### Setup wizard not showing

1. **Open Bridge Reborn** from the app drawer after installing from the panel. The service starts in the background, but the **setup wizard only runs when you open the app**.
2. After each **APK update or reinstall**, the wizard resets automatically (v0.3.8+ tracks install time and version code). You should see it on first launch of the new version.
3. If you skipped steps, tap **Run setup wizard** — it is always visible on the main screen (green header + orange banner when setup is incomplete).
4. Complete **battery unrestricted** and **autostart** steps for your OEM (Sunmi, Feitian, etc.).

### NFC / Tap to Pay not working

Check the **Tap to Pay (NFC)** card on Bridge Reborn’s main screen:

| Diagnostic | Meaning |
|------------|---------|
| **Adyen SDK: not in this APK** | You installed a **print-only stub** build (no Adyen keys at build time). Download the Tap to Pay APK from the merchant panel — it must be built with `adyenSdkApiKey` in `local.properties`. |
| **Adyen SDK: bundled** | Correct APK variant. |
| **NFC hardware: not available** | Tablet has no NFC — Tap to Pay cannot work on this device. |
| **Tap to Pay: not ready** | Read the message (e.g. missing panel config). |

**Merchant panel checklist:**

1. Settings → Payments → **Enable Tap to Pay**
2. Adyen **API key** + **merchant account** saved
3. Adyen **webhook HMAC** key configured
4. WebPOS on the tablet uses **Chrome** (same device as Bridge)

**WebPOS card payment:** Express checkout **Card** uses NFC only when Bridge reports `tapToPayReady: true` on `http://127.0.0.1:9101/health`. Open Bridge once so `PaymentActivity` can register the Adyen launcher.

**Verify health in Chrome on the tablet:** navigate to `http://127.0.0.1:9101/health` — expect `"hasAdyenSdk": true`, `"nfcAvailable": true`, `"tapToPayReady": true`.

### Version check

Bridge Reborn **0.3.8+** shows a green header at the top: **Bridge vX.Y.Z (build N)**. Match this to the version in Settings → Receipts & printers → Download Bridge Reborn. If you still see the old printer-only UI with no version header, the panel APK is stale — rebuild and upload `reborn-print-bridge.apk`.

---

## Project structure

```
print-agent-android/
  app/src/main/java/com/rebornsense/printbridge/
    service/PrintBridgeService.kt       # Foreground + NanoHTTPD :9101
    device/DeviceProfiler.kt          # D3 Mini / D2s Plus / F310A / generic
    print/PrinterDriver.kt            # Interface
    print/SunmiInternalDriver.kt
    print/UsbEscPosDriver.kt            # P1 — USB host + OTG
    print/BluetoothEscPosDriver.kt
    print/NetworkRawPrinterDriver.kt
    print/FeitianModuleDriver.kt        # P4
    print/DriverRegistry.kt             # Pick driver by printer profile
    queue/PrintJobQueue.kt
    setup/SetupWizardActivity.kt
    usb/UsbAttachReceiver.kt
```

Tech: Kotlin, min SDK 24, Room, NanoHTTPD/Ktor, Sunmi printerlibrary, Android USB Host API.

---

## Implementation phases (revised)

| Phase | Scope | Validates on |
|-------|--------|--------------|
| **1a** | HTTP service + queue + **Sunmi internal** | D3 Mini, D2s Plus |
| **1b** | **USB ESC/POS** + hot-plug | D3 Mini USB Type-A, OTG tablets |
| **2** | Bluetooth SPP + setup wizard | F310A, BT thermals |
| **3** | LAN RAW :9100 + panel APK release | Ethernet kitchen printers |
| **4** | Feitian F310-1 module + USB scale serial | F310A roadmap |

**Pilot hardware:** D3 Mini + D2s Plus (internal + USB) in parallel with one Feitian F310A (BT/USB).

---

## WebPOS behaviour (single device)

| Feature | Behaviour |
|---------|-----------|
| Receipt / kitchen | Local bridge only |
| Cloud relay to PC | **Disabled** when bridge healthy |
| Printer roles | Same as Windows — map names in Settings |
| D3 Mini 58 vs 80 mm | Bridge reports width; WebPOS receipt layout unchanged |

---

## Security

- `127.0.0.1` bind only
- USB: explicit user grant per device (Android permission dialog)
- Signed release APK (Reborn keystore)

---

## Testing checklist

- [ ] D3 Mini — built-in receipt + USB kitchen printer simultaneously
- [ ] D2s Plus — built-in 80 mm + cash drawer kick
- [ ] F310A — Bluetooth ESC/POS printer
- [ ] F310A — USB OTG thermal
- [ ] Generic 15″ tablet — USB OTG or BT only
- [ ] USB unplug mid-print → queue → replug → prints
- [ ] 50 consecutive tickets per device profile
- [ ] Cold boot → service up &lt; 10s

---

## Related

- Windows agent: `print-agent/`
- WebPOS: `dashboard/src/lib/print-agent.ts`
- Panel download: `dashboard/src/lib/print-agent-platform.ts`
