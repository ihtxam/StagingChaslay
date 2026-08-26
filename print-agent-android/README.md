# Reborn Print Bridge (Android)

Companion app for **WebPOS on Sunmi and other Android tablets** — not a POS app.  
WebPOS stays 100% in Chrome/PWA; this bridge is the local print layer (same role as Windows Print Agent).

## Problem

Browsers on Android cannot send ESC/POS bytes to Bluetooth, USB, or LAN printers.  
Merchants use **one device only** (15″ tablet) — no Windows hub PC.

## Solution

A small **always-on foreground service** on the tablet:

```
WebPOS (Chrome/PWA)  →  http://127.0.0.1:9101  →  Print Bridge  →  printer
```

**Same HTTP contract as Windows Print Agent** — WebPOS code changes are minimal.

---

## API contract (must match Windows agent)

| Endpoint | Method | Body / response |
|----------|--------|-----------------|
| `/health` | GET | `{ ok, version, platform: "android", features: [...] }` |
| `/printers` | GET | `{ printers: [{ name, isDefault?, connectionType }] }` |
| `/print` | POST | `{ printerName?, dataBase64 }` → `{ ok, printer }` |
| `/drawer` | POST | `{ printerName? }` — cash drawer kick |

Bind **127.0.0.1:9101** only (not LAN-exposed).

Optional later: `/scale/reading` for USB serial scales on Android OTG.

---

## Printer support (priority order)

### P1 — Sunmi built-in printer (ship first)

Most Sunmi V2/V3/T2/L2 counters have an **internal thermal printer** via Sunmi PrinterService (AIDL).

- Most reliable on Sunmi hardware
- No Bluetooth pairing
- Detect: `Build.MANUFACTURER` + Sunmi SDK / package `woyou.aidlservice.jiuiv5`

### P2 — Bluetooth ESC/POS (SPP)

Classic Bluetooth serial profile (`00001101-0000-1000-8000-00805F9B34FB`).

- Pair once in Android Settings → stored as saved printer profile
- Reconnect automatically on disconnect
- Chunk large jobs (4–8 KB) with flow control

### P3 — LAN / Wi‑Fi RAW (TCP 9100)

Printer on same Wi‑Fi with fixed IP or mDNS.

- `Socket(host, 9100)` + write ESC/POS bytes
- Timeout + retry (3×)

### P4 — USB OTG

USB thermal printers (vendor ID allowlist).

- `UsbManager` + permission intent
- Sunmi devices often lack OTG — lower priority

---

## Reliability design (foolproof)

### 1. Foreground service + persistent notification

Android kills background apps. Print Bridge runs as a **foreground service** with a low-profile notification (“Reborn Print Bridge — ready”).

- `START_STICKY` — OS restarts service if killed
- `BOOT_COMPLETED` receiver — auto-start after reboot
- `RECEIVE_BOOT_COMPLETED` + merchant opt-in “Start with device”

### 2. Local print queue (never lose a ticket)

```
WebPOS POST /print  →  queue in Room DB  →  worker prints  →  ack / retry
```

- If printer busy/offline: job stays queued, WebPOS gets `{ ok: true, queued: true }` **or** HTTP 202
- Worker retries: 1s, 2s, 5s, 10s, 30s (max 10 attempts)
- Survives WebPOS tab refresh (queue is in the bridge app)
- Optional: sync with WebPOS `webpos-print-queue` localStorage (belt + suspenders)

### 3. Connection watchdog

- Every 30s: ping default printer (short status command or test line in dev mode)
- On BT drop: auto-reconnect before next job
- Expose `/health` `printerReady: true|false` so WebPOS shows clear status

### 4. Battery / Doze exemption

On first run, guide merchant to:

- Disable battery optimization for Print Bridge
- Allow autostart (Sunmi/Xiaomi/Oppo have extra toggles)
- Pin app or add to “locked apps”

### 5. Single-tap setup wizard

1. Install APK (from panel download link)
2. Grant Bluetooth / notification permissions
3. Pick default printer (Sunmi internal / BT / IP)
4. Test print
5. Open WebPOS — green “Print Bridge ready”

### 6. WebPOS integration (already mostly done)

- `dashboard/src/lib/print-agent.ts` polls `http://127.0.0.1:9101/health`
- `retryLocally: true` on main till uses local queue + agent
- On Android: **disable cloud relay-to-main-till** when local agent is up (single-device mode)
- Settings: show **Download Print Bridge (Android)** when `navigator.userAgent` is Android

### 7. Diagnostics

- Rolling log file (last 500 lines) — upload from Settings in bridge app
- `/health` includes `lastError`, `lastPrintAt`, `queueDepth`
- Superadmin can request logs via existing client-error pipeline (future)

---

## Distribution (like Windows Print Agent)

| Channel | Path |
|---------|------|
| Merchant panel | Settings → Receipts & printers → **Download Print Bridge (Android)** |
| API | `GET /downloads/reborn-print-bridge.apk` |
| Deploy | `scripts/deploy-hetzner.sh` copies signed APK to `backend/public/downloads/` |

Versioning: `versionName` in APK + `/health.version` — WebPOS shows “Update Print Bridge” when outdated (same as Windows 1.6.0 check).

**Sunmi app store** (optional later): private channel for auto-updates on Sunmi devices.

---

## Project structure

```
print-agent-android/
  app/
    src/main/
      java/com/rebornsense/printbridge/
        service/PrintBridgeService.kt      # Foreground service + NanoHTTPD
        print/SunmiPrinterDriver.kt
        print/BluetoothEscPosDriver.kt
        print/NetworkRawPrinterDriver.kt
        print/UsbEscPosDriver.kt
        queue/PrintJobQueue.kt             # Room DB + worker
        setup/SetupWizardActivity.kt
      AndroidManifest.xml
  build.gradle.kts
```

Tech stack:

- **Kotlin** + min SDK 24 (Android 7), target SDK 34
- **NanoHTTPD** or Ktor CIO for localhost HTTP (lightweight)
- **Room** for persistent queue
- **Sunmi printer SDK** (vendor AAR)
- **No WebView** — not a POS UI

---

## Implementation phases

| Phase | Scope | Outcome |
|-------|--------|---------|
| **1** | Sunmi internal printer + `/health` `/print` `/printers` | Sunmi tablets print receipts from WebPOS |
| **2** | BT ESC/POS + queue + boot autostart | Generic Android tablets + BT printers |
| **3** | LAN RAW + setup wizard + panel APK download | Full retail deployment |
| **4** | USB OTG + scale serial | Butcher / weighed goods |

**Phase 1 target:** 1–2 weeks of focused Android work for Sunmi-only pilot.

---

## WebPOS behaviour on Android (single device)

| Feature | Behaviour |
|---------|-----------|
| Receipt print | Local agent only (`retryLocally: true`) |
| Kitchen print | Local agent (same tablet) |
| Cloud relay queue | **Off** when Android agent healthy |
| Offline sales | PWA offline + queue prints when agent returns |
| Printer status | Header shows bridge green/red (existing WebPOS UI) |

---

## Security

- HTTP bound to `127.0.0.1` only
- Optional shared secret header `X-Print-Bridge-Token` (generated per install) if we ever allow LAN
- APK signed with Reborn release key; Play Protect / Sunmi trust

---

## Testing checklist

- [ ] Cold boot → service auto-starts → `/health` OK within 10s
- [ ] WebPOS sale → receipt prints &lt; 2s
- [ ] Kill bridge app → OS restarts → next print works
- [ ] BT printer powered off → job queued → prints when powered on
- [ ] 50 consecutive receipts without stall
- [ ] Sunmi V2/V3 + generic 15″ tablet
- [ ] Battery saver on — still prints after wizard exemption

---

## Related

- Windows agent: `print-agent/`
- WebPOS client: `dashboard/src/lib/print-agent.ts`
- Print queue: `dashboard/src/lib/webpos-print-queue.ts`
