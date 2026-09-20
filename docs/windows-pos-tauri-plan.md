# Windows Tauri POS — architecture recommendation

**Status:** audit of this repository (`rebornSense` / Chaslay POS), not a ChatGPT plan.  
**Date:** 2026-09-20  
**Constraint:** industry-grade, fool-proof, low maintenance, ~1000 remote Windows tills in a year, **no on-site support**. Keep existing WebPOS UI + backend. Native Tauri hardware is the **destination**, not day-one work.

**Verdict in one line:** ship a **Tauri 2 shell** that wraps today’s WebPOS and **sidecars the existing Print Agent**. Do **not** rewrite hardware, ESC/POS, or catalog storage first.

---

## Executive decision

| Question | Answer |
|----------|--------|
| Is native Tauri hardware the right **first** step? | **No.** It is the right **last** hardware step. |
| What is the right first step? | **Tauri 2 kiosk shell** (no browser chrome, single instance, fullscreen, autostart) loading the existing dashboard WebPOS. |
| Keep Print Agent? | **Yes**, first as today’s localhost:9101 daemon, then as a **sidecar inside the same installer**. |
| Native Rust printers/scales/drawer? | **Yes later**, only after the sidecar is boring in production. Do not rewrite ESC/POS in Rust on day 1. |
| New SQLite catalog? | **No.** WebPOS already has IndexedDB catalog + sale outbox. SQLite exists only on the **Android native POS**, a different product. |
| Implement Tauri in this PR? | **Phase A scaffold is in `desktop/`.** Build the NSIS installer on a Windows machine with WebView2 + codesign. |

The user wants native hardware. That is compatible with this plan: **same HTTP contract, same JS formatter, swap the transport** after the shell + sidecar are operational. Native hardware without a single installer, auto-update, and diagnostics is how 1000 remote tills become unsupportable.

---

## What exists today (audit)

### 1. Frontend — dashboard WebPOS (React + Vite)

| Item | Reality |
|------|---------|
| Stack | React 18, Vite 5, TypeScript, Zustand, React Router (`dashboard/package.json`) |
| Till UI | `dashboard/src/pages/merchant/WebPos.tsx` (~12k lines) plus `dashboard/src/components/webpos/*` |
| Routes | `/merchant/pos` (register), `/merchant/waiter` (`WaiterApp`), kiosk `/kiosk/*`, CDS/KDS/ODS |
| Router | `dashboard/src/App.tsx` — WebPOS/waiter treated as kiosk-like chrome |
| API client | `dashboard/src/lib/api.ts` — JWT from `localStorage.token`, `X-Location-Id` |
| Receipt bytes | **Generated in the browser**, not in the agent: `dashboard/src/lib/webpos-receipt.ts` |
| Hardware client | `dashboard/src/lib/print-agent.ts` → `http://127.0.0.1:9101` |
| Electron stub | `window.manuposDesktop` is typed in `print-agent.ts` — **no Electron/Tauri app exists** |

WebPOS is not a small register. It already owns cart, PIN, shifts, kitchen routing, labels, gift cards, Adyen, offline outbox, print relay, and Android Bridge pairing. Replacing it is not an architecture move; it is a product rewrite.

### 2. PWA / service worker

| File | Role |
|------|------|
| `dashboard/public/manifest.webmanifest` | `start_url: /merchant/pos`, `display: standalone` |
| `dashboard/public/sw.js` | Shell cache `reborn-shell-v11`; **never caches `/api`** |
| `dashboard/src/main.tsx` | Registers `/sw.js` in production (not on shop hosts) |
| `dashboard/src/lib/pwa.ts` | Install prompt, “open in app”, standalone detection |
| `dashboard/src/lib/pwa-recover.ts` | Unregister SW + wipe caches after stale-chunk crashes |
| `dashboard/PWA.md` | Current Windows install story: Edge/Chrome “Install as app” |

`dashboard/PWA.md` already states: *“PWA is the right first step. Electron/Tauri would ship a full desktop runtime.”* That was correct when the goal was “double-click POS.” It is **insufficient** for 1000 unattended Windows tills (browser chrome, no autostart contract, SW cache poison, two installers). Tauri is justified as an **ops shell**, not as a new POS.

### 3. Backend API — auth / orders / products

| Area | Path |
|------|------|
| Auth | `POST /api/auth/login` (`backend/src/routes/auth.routes.ts`), JWT in `AuthService` (`backend/src/services/auth.service.ts`) |
| Merchant JWT | `verifyToken` + `requireMerchant` (`backend/src/middleware/auth.middleware.ts`) |
| Products | `GET/POST/PUT /api/merchant/products*` (`backend/src/routes/merchant.routes.ts`) |
| Orders | `/api/merchant/orders*` (same file) |
| Offline sales | `POST /api/sync/push-sales` — **idempotent by `clientId`** (`backend/src/routes/sync.routes.ts`) |
| Catalog pull | `GET /api/sync/pull` |
| Print job hub | `/api/merchant/pos/print-jobs` (waiter/kiosk → till) |
| Entitlement | `WebPosEntitlementService` — subscription/trial, independent of Android seat licenses |
| Device seats | `devices` + `licenses` tables (`backend/src/lib/ensure-licenses-schema.ts`) — Android POS seats, not WebPOS identity |
| Till sessions | `pos_sessions` (`backend/src/services/pos-sessions.service.ts`) — `main` / `waiter`, platform `webpos` |

WebPOS sales already go through `/sync/push-sales` even when online (`WebPos.tsx` checkout). A native SQLite write path that bypasses this is a second source of truth.

### 4. Print Agent architecture

Local HTTP daemon, **Windows only**, current version **1.10.5**.

```
WebPOS (browser/PWA)
    POST/GET http://127.0.0.1:9101
Print Agent (Node packed with pkg → reborn-print-agent.exe)
    Win32 RAW WritePrinter (PowerShell worker)
    Aclas USB-serial scale
    Niimbot bitmap protocol
    TSPL labels (LuckyDoor / EML) via same /print RAW path
    ESC/POS drawer kick
    Cloud relay poller → /merchant/pos/print-jobs
```

| Piece | File |
|-------|------|
| HTTP server | `print-agent/server.js` — binds **`127.0.0.1:9101` only** |
| Endpoints | `GET /health`, `GET /printers`, `POST /print`, `POST /print/niimbot-label`, `POST /print/dry-run`, `POST /drawer`, `GET /scale/ports`, `GET /scale/reading`, `POST/GET /cloud-relay` |
| RAW print | `print-agent/win-raw-print.ps1`, `win-raw-print-worker.ps1` (warm worker — BT OpenPrinter is expensive) |
| Scale | `print-agent/win-scale-read.ps1`, `aclas-scale.js` |
| Niimbot | `print-agent/niimbot-client.js`, `win-niimbot-print.ps1` |
| Install | `--install` → `%LOCALAPPDATA%\RebornPrintAgent`, `HKCU\...\Run`, 1-minute Task Scheduler watchdog (`print-agent/windows-native.js`) |
| Packager | `print-agent/build-installer.ps1` → `pkg` Node 18 win-x64 EXE |
| Download | `backend/src/lib/downloads.ts` serves `reborn-print-agent-setup.exe` |
| UI install | Settings → Receipts (`dashboard/src/pages/merchant/Settings.tsx`), version widget `PrintCompanionVersionStatus.tsx` |

**Not a Windows Service.** Hidden per-user process + VBS launcher + watchdog. Unsigned EXE; SmartScreen warns. Update = **download setup EXE and run it again**. There is **no silent auto-update**.

Hard-won Windows behavior already in the agent (do not throw away):

- Unicode printer names (`OpenPrinterW` via UTF-8 file)
- Reject OneNote / Print to PDF / XPS
- COM remapping by device **name** (CH340 COM number changes)
- Bluetooth/COM paced spooler vs USB unpaced RAW (`usb-unpaced-raw`, `faster-bt-com-pace`)
- Niimbot is **not** ESC/POS
- Drawer is pulse-only (`1B 70 00 19 FA`) — `/drawer` with `/print` fallback in `print-agent.ts`

### 5. Existing offline (IndexedDB + outbox)

| File | Role |
|------|------|
| `dashboard/src/lib/webpos-offline/db.ts` | IndexedDB `manupos_webpos_offline_v1` stores: `meta`, `catalog`, `outbox` |
| `catalog-cache.ts` | Snapshot: categories, products, merchant, payment config, entitlement, print settings, staff |
| `outbox.ts` | Pending sales keyed by `clientId` |
| `sync-engine.ts` | Flush to `/sync/push-sales` on `online` + every 30s |
| `guards.ts` | Offline-safe tenders: **cash, card, express, invoice**. Blocked: terminal, gift cards, pay-later |
| `WebPos.tsx` | Hydrate snapshot if catalog fetch fails; enqueue outbox if offline |

Service worker caches **UI shell only**. Catalog and sales live in IndexedDB. This is already the Windows WebPOS offline design.

Toggle: `localStorage manupos_webpos_offline !== '0'`.

### 6. Hardware map

| Device | Path today |
|--------|------------|
| Thermal receipt / kitchen | ESC/POS bytes from `webpos-receipt.ts` → agent `/print` → Windows spooler |
| Cash drawer | `print-agent.ts` `openDrawer()` → `POST /drawer` |
| Kitchen routing | `pos-print-settings.ts` printer profiles + `linkedCategoryIds`; waiters/kiosk queue via print-jobs |
| Product / order labels | TSPL RAW or Niimbot `/print/niimbot-label` |
| Aclas USB scale | Settings scan → saved name/PNP id → `/scale/reading` |
| Android tablet till | **Bridge Reborn** APK (`print-agent-android/`) — **same 9101 contract** + USB/BT/LAN/Sunmi + NFC tap-to-pay |
| Waiter phones | No local agent; `enqueueEscPosPrintJob` → cloud → till hub / Print Agent cloud-relay |
| Failed local prints | `webpos-print-queue.ts` (localStorage retry queue, not IndexedDB) |

There is **no LAN-only POS catalog**. Print Agent is loopback-only. “LAN POS” in this codebase means: waiter/kiosk devices send print jobs through the **cloud hub** to the till that has the agent.

### 7. Settings, device identity, “auto-update”

| Concern | Reality |
|---------|---------|
| Printer / scale / kitchen | Merchant `posPrintSettings` JSON (`backend/src/lib/pos-print-settings.ts`), edited in Settings → Receipts |
| WebPOS device id | `localStorage manupos_webpos_device_id` (`webpos-print-relay.ts`) — UUID, not the Android `devices.device_id` license row |
| Print Agent update | Compare `/health.version` vs `reborn-print-agent.json`; show download link. **Manual reinstall.** |
| Dashboard update | PWA SW `SKIP_WAITING` + Vite hashed assets. Known failure: stale SW → blank POS (`pwa-recover.ts`) |
| Codesign | Print Agent **unsigned** (`signed: false` in installer manifest) |

### 8. Current installer story (what ChatGPT may invent vs what exists)

| Claim | In this repo? |
|-------|----------------|
| MSIX / Appx / Windows App SDK | **No.** Zero matches. |
| Electron app | **No.** Only a `window.manuposDesktop` type stub. |
| Tauri app | **No.** |
| Print Agent setup EXE | **Yes.** `reborn-print-agent-setup.exe` via `/downloads/` |
| PWA “install as app” | **Yes.** Edge/Chrome + `manifest.webmanifest` |
| Single combined Windows installer | **No.** Two (or three on Android: PWA + Bridge APK) |
| Auto-update | **No** for the agent. Partial (SW) for the UI — and it already causes blank-screen recoveries. |

`README.md` still describes the **Kotlin Android POS** (`app/`, Room SQLite). That is a parallel product. Windows WebPOS is the dashboard PWA + Print Agent.

---

## What ChatGPT got RIGHT

These ideas match this codebase and the 1000-device constraint:

1. **Keep WebPOS UI and the existing backend.** The till is `WebPos.tsx` + `/api/merchant` + `/api/sync`. Do not port catalog/orders to a new desktop backend.
2. **Windows needs a real kiosk shell.** PWA-in-Edge is not autostart, not single-instance, not fool-proof for cashiers, and SW caches already break POS (`pwa-recover.ts`).
3. **Hardware must stay local.** Browsers cannot WritePrinter, kick drawers, or talk Aclas/Niimbot. Something on the PC must own Win32/USB/COM. That is already Print Agent.
4. **A single installer matters more than elegant internals.** Today: install PWA, then find Settings, then download an unsigned EXE, then survive SmartScreen. That will not scale to 1000 remote tills.
5. **Diagnostics + remote update are the real ops problem.** Print Agent already has `/health`, dry-run, Niimbot diagnostics, `install.log`. There is no one-click “send logs” or silent update.
6. **Native hardware is a valid destination** if it **implements the existing 9101 contract** (or a Tauri invoke that `print-agent.ts` can call without changing ticket code).
7. **Don’t support devices by driving to them.** Autostart, watchdog, single instance, and a support zip are mandatory. The agent already has a 1-minute watchdog for 9101 — the shell needs the same class of thinking.

---

## What ChatGPT got WRONG for *this* codebase

Be specific. Generic “offline-first Tauri POS” plans describe a greenfield app. This is not greenfield.

### 1. Inventing a second SQLite catalog

WebPOS already snapshots catalog + config into IndexedDB and syncs sales with `clientId` idempotency:

- DB: `dashboard/src/lib/webpos-offline/db.ts` (`manupos_webpos_offline_v1`)
- Push: `POST /api/sync/push-sales` (`backend/src/routes/sync.routes.ts`)
- Checkout already uses that path (`WebPos.tsx`)

Room SQLite is the **Android native POS** (`app/`, `docs/UNIFIED_SETTINGS.md`, root `README.md`). Copying that model onto Windows WebPOS creates:

- Two catalogs (IDB vs SQLite) that will drift
- Two outboxes
- A Rust/SQL layer support cannot see from Chrome DevTools
- No benefit for the actual gap (kiosk chrome + hardware transport + updates)

**Decision: no SQLite catalog on Windows unless IndexedDB is proven insufficient** (quota, multi-window, or encryption). Audit does not show that. See [Decision: SQLite](#decision-sqlite) below.

### 2. Replacing Print Agent on day 1

`print-agent/` is not a toy HTTP stub. It is years of Windows printer reality: BT pacing, USB unpaced write, COM remaps, unicode names, virtual-printer guards, Niimbot vs TSPL vs ESC/POS, Aclas, drawer kick, cloud-relay for waiters.

ChatGPT-style “use `escpos` crate + `serialport`” recreates a subset and breaks kitchen tickets on Bluetooth Xprinters. The dashboard **already formats tickets in TypeScript**. The agent only ships bytes. Native hardware does not require a Rust receipt engine.

### 3. 31 phases

A 31-phase plan is a research program. With 1000 remote devices and no truck roll, every extra phase is another install matrix. Support can hold **one** Windows POS SKU in their head: “Chaslay POS.exe = WebView + Print Agent.” Five to seven phases, each shippable to a pilot till, is the maximum.

### 4. Duplicate hardware stacks

Today there are already **two** 9101 implementations (Windows Node agent, Android Kotlin Bridge) sharing one client (`print-agent.ts`). Adding a third (Rust native) **while keeping** the EXE **and** the PWA **and** `window.manuposDesktop` is a support nightmare.

Rule: **one Windows transport at a time.** Sidecar (existing agent) → then native Tauri that **replaces** the sidecar. Never both.

### 5. Three update channels

If you add Tauri updater **and** keep Print Agent setup EXE **and** keep the PWA service worker:

| Channel | Failure mode in the field |
|---------|---------------------------|
| PWA SW | Stale `reborn-shell-v*` → blank till (`pwa-recover.ts` exists because this already happens) |
| Print Agent EXE | Unsigned, SmartScreen, EBUSY if process running, “reinstall from Settings” |
| Tauri updater | WebView2 / signature / rollback |

Cashiers will run mixed versions. Kitchen print will fail as “agent too old” (`MIN_PRINT_AGENT_VERSION = 1.9.5`, `MIN_NIIMBOT_AGENT_VERSION = 1.10.2`) while UI is new.

**Requirement:** one Windows installer, one updater, Print Agent version **pinned inside that installer**. Disable or bypass the POS SW inside the Tauri WebView (load production URL with cache-control, or register no SW).

### 6. MSIX as the current installer

There is **no MSIX**. Inventing Appx identity, Store signing, and sparse packages is extra Microsoft process on top of an unsigned `pkg` EXE. Prefer **NSIS/WiX/Tauri bundled installer** that also drops the sidecar, then codesign. MSIX can be a later distribution option; it is not a prerequisite.

### 7. LAN-only mesh POS

Print Agent binds **127.0.0.1**. Waiter phones do not print over LAN; they enqueue `/merchant/pos/print-jobs`. Cloud-relay in the agent polls that API with a stored JWT. A “LAN-only SQLite cluster” is a different product and fights this hub model.

### 8. Rewriting ESC/POS in Rust

Ticket layout, VAT tables, QR module size, kitchen scale/bold, CHF→EUR, Google review QR, delivery maps QR, order labels — all live in `dashboard/src/lib/webpos-receipt.ts` and related TS. Native code should accept `dataBase64` the way `/print` does today.

### 9. Treating Android Bridge as disposable

Android tills use the **same** client and port (`print-agent-android/README.md`). Windows native hardware must not fork the JSON contract or Android WebPOS breaks conceptually (two mental models for “the companion”). Keep 9101 semantics even if the Windows transport becomes a Tauri sidecar instead of a public localhost port.

### 10. `window.manuposDesktop` as an existing desktop app

It is a **legacy type** so `print-agent.ts` can skip HTTP when a future bridge exists. There is no implementation. Do not plan migrations from Electron.

---

## Recommended architecture (1000 remote Windows devices)

```
┌─────────────────────────────────────────────────────────────┐
│  Chaslay POS.exe  (Tauri 2, one installer, codesigned)      │
│                                                             │
│  ┌──────────────────────────┐   ┌─────────────────────────┐ │
│  │ WebView2                 │   │ Sidecar (Phase C)       │ │
│  │ existing dashboard       │   │ reborn-print-agent.exe  │ │
│  │ /merchant/pos            │──▶│ 127.0.0.1:9101          │ │
│  │ same IndexedDB/outbox    │   │ later: Tauri plugin     │ │
│  └──────────────────────────┘   └─────────────────────────┘ │
│  autostart · single instance · fullscreen · watchdog        │
│  auto-update (one channel) · diagnostics zip                │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              existing backend /api  (JWT, sync, print-jobs)
```

### Why shell first, native hardware later

| If you start with native hardware | If you start with a Tauri shell |
|-----------------------------------|----------------------------------|
| Rewrite Win32 print/scale/Niimbot while cashiers still use Chrome + old EXE | Same print path that already works |
| Two UIs to debug (half-ported register) | Zero UI change |
| No autostart/update yet → still truck-roll | Ops problems (chrome, autostart, SW) solved first |
| 31-phase slip | Pilot on 1 PC this month |

Native Tauri hardware **is** the destination the user asked for. The reliable path is:

1. Tauri shell wrapping WebPOS (no browser chrome, fullscreen, autostart, single instance)
2. Keep Print Agent as hardware daemon, then **embed it as sidecar** (no separate “download the EXE from Settings”)
3. Reuse IndexedDB/outbox — do not invent SQLite
4. **Single installer:** WebView2 runtime + app + Print Agent sidecar + autostart
5. **Diagnostics + auto-update as #1 ops requirement** for 1000 remote devices

`print-agent.ts` already prefers `window.manuposDesktop` when present. Phase B is a thin platform adapter (HTTP 9101 vs Tauri invoke) with **one** implementation behind it — not a second stack.

---

## Decision: SQLite {#decision-sqlite}

**Recommend against** duplicating catalog/sales into SQLite on Windows.

| Need | IndexedDB today | SQLite would help? |
|------|-----------------|-------------------|
| Catalog while offline | Yes, full snapshot after one online boot | No |
| Sale outbox + idempotent sync | Yes, `clientId` | No — would duplicate `/sync/push-sales` |
| Print retry queue | `localStorage` (`webpos-print-queue.ts`) | Maybe later, not a catalog DB |
| Encryption at rest | Browser profile | Nice-to-have; BitLocker on the till is the real control |
| Multi-process native daemon | N/A | Only if a native sidecar must read catalog **without** WebView — not required if JS still formats tickets |
| Android POS offline | Room in `app/` | Already exists — **do not merge** |

Revisit SQLite only if: WebView quota drops catalogs, or a native sidecar must sell with the WebView dead. Neither is true for Phase A–C.

---

## Decision: native Tauri hardware

**Yes as destination. Sidecar first.**

User intent: native Tauri hardware, industry-grade, no remote visits.

Correct sequence:

1. **Sidecar** = today’s `print-agent` binary spawned by Tauri, still on 9101. Windows printers, Aclas, Niimbot, drawer, cloud-relay keep working. Settings “Download Print Agent” becomes unnecessary on Tauri tills.
2. **Native plugin** implements the **same JSON** (`/print`, `/drawer`, `/scale/*`, `/printers`, `/health`) via `invoke`, and `print-agent.ts` switches transport. Ticket TS unchanged.
3. **Then** delete the Node/pkg EXE from the Windows SKU.

Do **not** rewrite ESC/POS in Rust on day 1. Do **not** run sidecar and native plugin in parallel in production.

Android stays on Bridge Reborn + PWA/Chrome. This document is Windows-only. Do not unify Android into Tauri.

---

## Minimal phased plan (7 phases)

Each phase must be **installable on a real till** and leave a rollback (PWA + standalone Print Agent still works until Phase C is default).

### Phase A — Tauri 2 shell (ops chrome)

**Goal:** one EXE that is the till window.

- Tauri 2 + WebView2, load production panel URL (`https://app.…/merchant/pos`)
- Single instance, fullscreen kiosk, autostart on login
- No browser chrome, block DevTools in prod, ESC behavior stays “exit fullscreen only” (already in WebPOS)
- Do **not** bundle a second UI
- Do **not** register the dashboard service worker inside the WebView if it can be avoided (prevents `reborn-shell-v*` poison). If SW cannot be skipped, ship a kill-switch and reuse `pwa-recover.ts`.
- Codesign. Unsigned Tauri + unsigned Print Agent is two SmartScreen fights.

**Exit:** cashier double-clicks Chaslay POS, sees existing WebPOS, still uses **separately installed** Print Agent on 9101.

### Phase B — platform abstraction

**Goal:** one client module, two transports.

- Keep `dashboard/src/lib/print-agent.ts` as the only WebPOS hardware API
- Extract `agentFetch` behind `http://127.0.0.1:9101` vs future `invoke('print_agent', …)`
- Implement `window.manuposDesktop` **or** a `chaslayDesktop` equivalent from Tauri so list/print/status work without rewriting callers
- Tests stay in `print-agent*.test.ts` / `webpos-print-targets.test.ts`

**Exit:** WebPOS does not care whether 9101 is a sidecar or a plugin.

### Phase C — sidecar Print Agent (single installer)

**Goal:** stop asking merchants to download `reborn-print-agent-setup.exe`.

- Tauri sidecar = current `print-agent` EXE (or `node` script packed as today)
- Spawn on app start; reuse loopback 9101; keep cloud-relay
- Autostart of the **app** implies the sidecar; drop a second HKCU Run if the app watchdog is enough
- Pin sidecar semver to the app version (no “UI 2.4 + agent 1.8”)
- Settings UI: hide Windows download when running inside Tauri; still show version from `/health`

**Exit:** one installer on a new PC is enough for WebPOS + printing + scale + drawer. This is the **production default** for the 1000-device fleet.

### Phase D — native Tauri hardware (replace sidecar)

**Goal:** user’s native hardware, without a Node runtime.

- Win32 RAW print, drawer, Aclas scale, Niimbot — **feature-flagged**, one printer class at a time
- Start with USB RAW receipt (the well-tested path); BT pacing and Niimbot last
- Same payloads as `POST /print` (`dataBase64`, `printerName`)
- Remove sidecar only after a pilot of native transport matches sidecar logs

**Exit:** no `pkg` Node on Windows SKU. Android Bridge unchanged.

### Phase E — offline reuse (not a new database)

**Goal:** Tauri WebView uses the **same** IndexedDB outbox.

- Confirm WebView2 persists IDB per app identity across updates
- Persist print retry queue (`webpos-print-queue.ts`) across shell restarts
- Optional: diagnostics include outbox counts (`getOfflineSyncState`)
- Still no SQLite catalog

**Exit:** offline cash/card/express works in the shell exactly as in the PWA (`dashboard/PWA.md`).

### Phase F — auto-update + diagnostics (ops #1)

**Goal:** 1000 devices without a visit.

- **One** updater (Tauri) ships app + sidecar/native plugin together
- Signed updates; skip if till is in an open sale (hook WebPOS “idle”)
- Support zip: `/health` JSON, last print errors, `install.log`, agent version, WebView version, outbox counts, `posPrintSettings` (redact tokens), screenshot optional
- Cloud-relay JWT refresh (today the agent stores a static bearer in `cloud-relay.json` — a time bomb when JWT expiry is 24h)
- Kill PWA-as-POS documentation for Windows; PWA remains for macOS/Linux/ad-hoc

**Exit:** support can say “Help → Send diagnostics” and “it will update tonight.”

### Phase G — pilot 1 → 3 → 10

| Gate | Devices | Pass bar |
|------|---------|----------|
| G1 | 1 internal till | Full day: cash, card, kitchen USB, drawer, scale, restart, reprint |
| G2 | 3 merchant tills (USB + at least one BT kitchen if that site has it) | No silent print loss; update once |
| G3 | 10 mixed (retail + restaurant) | Diagnostics used in anger; sidecar version pinned; no dual-install confusion |

Do not announce fleet rollout before G3. Rollback = uninstall Tauri app, Chrome PWA + old Print Agent still documented.

---

## What not to do

- Do not fork `WebPos.tsx` into a “desktop POS.”
- Do not add `better-sqlite3` / `sqlx` catalog tables.
- Do not expose Print Agent on `0.0.0.0` (security + “LAN POS” fantasies).
- Do not maintain Electron (`manuposDesktop`) **and** Tauri.
- Do not put MSIX, Store, and NSIS in the first installer.
- Do not auto-update the UI while leaving Print Agent on 1.8.x.
- Do not rewrite Niimbot or Aclas in Rust until sidecar metrics say those jobs are the pain (they are specialized and already shipped).

---

## Phase A — scaffold (in `desktop/`)

Layout:

```
desktop/
  src-tauri/
    tauri.conf.json               # NSIS bundle, empty windows (created in Rust)
    Cargo.toml
    src/lib.rs                    # fullscreen window, host allow-list, autostart cmds
    src/main.rs
  README.md                       # build installer
```

A Linux cloud agent cannot verify WebView2, SmartScreen, or WritePrinter. Produce the installer on Windows.

### Intended `tauri.conf.json` behavior

- `app.windows[0]`: fullscreen, decorations false, `url` = production `/merchant/pos` (or login)
- `plugins`: `single-instance`, autostart
- Bundle: NSIS (or WiX), WebView2 bootstrapper
- Sidecar: **not in Phase A** (still use installed Print Agent)

### Build installer (Phase A)

```powershell
# Windows builder with Rust + WebView2 + Node
cd desktop
npm create tauri-app  # only once; then pin Tauri 2
cargo tauri build
# Output: NSIS/MSI under src-tauri/target/release/bundle/
```

Load the **deployed** dashboard URL, not a second Vite build of WebPOS. Dev can point `devUrl` at `http://localhost:5173`. Production must not embed a stale SPA — UI updates continue to come from the hosted dashboard **until** Phase F pins UI+agent together. Until F, the shell is a kiosk browser with discipline; the hosted app remains the source of UI truth (same as today’s PWA). That is intentional: it avoids a frozen UI inside the EXE while merchants get dashboard deploys.

Phase F is when you decide whether to **bundle** the SPA (true offline UI without SW) or keep loading hosted UI. Bundling implies the updater ships UI; hosted implies UI updates without an EXE bump. For 1000 devices, **hosted UI + sidecar hardware + EXE updater for shell/hardware** is fewer frozen tills, **if** you disable SW. If SW stays, hosted UI updates will keep causing blank screens.

### Phase A acceptance

- One running instance
- Autostart after reboot + Windows login
- Fullscreen POS
- Existing Print Agent still prints
- Uninstall cleanly

---

## Ops reality for 1000 remote devices

Priority order (honest):

1. **One installer + autostart + single instance** (Phase A+C)
2. **One auto-update + diagnostics zip** (Phase F)
3. **Sidecar so Settings EXE download disappears** (Phase C)
4. Native hardware (Phase D) — quality and removing Node, not a new feature
5. Offline polish (Phase E) — already mostly works in PWA

The highest-risk production bugs in this repo are already hardware + cache: stale PWA, old Print Agent vs Niimbot min version, BT kitchen pacing, unsigned EXE EBUSY. Native Rust does not fix those until the shell and updater exist.

JWT in Print Agent `cloud-relay.json` is a latent fleet bug (24h expiry in `AuthService.JWT_EXPIRY`). Phase F must refresh tokens from the logged-in WebView. Do not wait for a 31-phase plan to notice this.

---

## File index (audit trail)

| Area | Files |
|------|--------|
| WebPOS | `dashboard/src/pages/merchant/WebPos.tsx`, `dashboard/src/components/webpos/*` |
| PWA | `dashboard/public/sw.js`, `manifest.webmanifest`, `dashboard/PWA.md`, `dashboard/src/lib/pwa.ts`, `pwa-recover.ts` |
| Offline | `dashboard/src/lib/webpos-offline/*` |
| Hardware client | `dashboard/src/lib/print-agent.ts`, `print-agent-platform.ts`, `webpos-print-relay.ts`, `webpos-print-queue.ts`, `webpos-receipt.ts` |
| Windows agent | `print-agent/server.js`, `windows-native.js`, `*.ps1`, `build-installer.ps1`, `README.md` |
| Android companion | `print-agent-android/` (same 9101 + NFC) |
| Backend sync/print | `backend/src/routes/sync.routes.ts`, `merchant.routes.ts` (`/pos/print-jobs`), `downloads.ts` |
| Auth | `backend/src/services/auth.service.ts`, `routes/auth.routes.ts` |
| Print settings | `backend/src/lib/pos-print-settings.ts` |
| Android POS (separate) | `app/` Room SQLite — **not** the Windows path |
| Existing strategy notes | `docs/MOBILE_APPS_STRATEGY.md` (PWA/TWA, not Windows Tauri), `docs/UNIFIED_SETTINGS.md` (Android SQLite) |

---

## Summary for stakeholders

| ChatGPT impulse | This repo |
|-----------------|-----------|
| New desktop POS | Wrap WebPOS |
| SQLite catalog | IndexedDB already there |
| Native printers week 1 | Sidecar Print Agent first |
| 31 phases | 7 phases, G1–G3 pilot |
| MSIX now | Does not exist; NSIS/Tauri bundle + codesign |
| Three updaters | One EXE channel; pin agent version; tame or drop SW |

**Native Tauri hardware: approved destination. Tauri shell + Print Agent sidecar: required first product.**
