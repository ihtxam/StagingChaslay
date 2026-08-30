# Device hardware notes (Reborn stock)

Reference for Bridge Reborn driver development and QA devices.

**One universal APK** — drivers are chosen at runtime. We do **not** ship Sunmi-only builds.

## In stock (pilot QA)

| Device | Built-in print | USB printers |
|--------|----------------|--------------|
| **Sunmi D3 Mini** | ✅ 58/80 mm | ✅ 3× USB 3.0 Type-A host (kitchen/receipt/label on USB) |
| **Sunmi D2s Plus** | ✅ 80 mm | ✅ USB peripheral ports |

## Roadmap

| Device | Notes |
|--------|--------|
| **Feitian F310A** | Handheld — BT + USB-C OTG; optional F310-1 print module later |
| **Generic local Android** | 15″ tablets and OEM POS — USB OTG, BT, LAN :9100 |

USB ESC/POS is **phase 1** alongside Sunmi built-in — not a later add-on.

---

## Sunmi D3 Mini

- **Role:** Main counter / 10.1″ WebPOS tablet
- **OS:** SUNMI OS (Android 13)
- **Built-in printer:** 58 mm or 80 mm thermal (variant in model name)
- **USB:** 3× USB 3.0 **Type-A host** — use for external receipt/kitchen/label printers without OTG adapters
- **LAN:** RJ45 — Wi‑Fi/LAN kitchen printers on same network
- **Bridge driver:** `SunmiInternalDriver` + `UsbEscPosDriver` (Type-A) + `NetworkRawDriver`

## Sunmi D2s Plus

- **Role:** Desktop counter terminal
- **OS:** SUNMI OS (Android 7.1 / 11 depending on config)
- **Built-in printer:** 80 mm, 250 mm/s, auto cutter
- **Bridge driver:** `SunmiInternalDriver` + USB/LAN as connected

## Feitian F310A

- **Role:** Compact handheld (6.5″, Android 13)
- **Built-in printer:** None on base F310A
- **USB:** Type-C **OTG** — USB thermal via cable/adapter
- **Bluetooth:** 5.0 BLE + classic — primary for portable BT printers
- **Modules (future):** F310-1 printer, F310-18 scan+print — pogo pin attachment
- **Bridge driver:** `BluetoothEscPosDriver` + `UsbEscPosDriver` (OTG) → later `FeitianModuleDriver`

## Generic local Android tablets (~15″)

- **Built-in printer:** Usually none
- **USB:** Micro-USB or USB-C OTG (device-dependent)
- **Bridge driver:** `UsbEscPosDriver` + `BluetoothEscPosDriver` + `NetworkRawDriver`

## QA matrix (minimum before merchant rollout)

| Test | D3 Mini | D2s Plus | F310A | Generic tablet |
|------|---------|----------|-------|----------------|
| Internal print | ✅ | ✅ | n/a | n/a |
| USB print | ✅ Type-A | ✅ | ✅ OTG | ✅ OTG |
| Bluetooth | ✅ | ✅ | ✅ | ✅ |
| LAN :9100 | ✅ | ✅ | ✅ | ✅ |
| Drawer kick | ✅ RJ12 | ✅ | optional | via receipt printer |
