# Tablet rollout: Bridge APK + WebPOS (POS offset, kitchen, USB scale)

Use this checklist after merging **PR #910** (`cursor/kitchen-receipt-pos-offset-1b4f`) on top of **main** (which already includes **#912** Bridge USB/scale parity via `feat/pos-bridge-usb-scale-and-retail`).

## Merge order (GitHub)

| Step | PR / branch | Action |
|------|-------------|--------|
| 1 | **#912** | Already on `main` — Bridge USB permission parity + WebPOS scale HTTP client |
| 2 | **#910** | **Merge first** — kitchen tickets, Settings/WebPOS viewport offset, USB≠LAN printer reconcile, `isValidAgentRawPrintBase64` |
| 3 | **#911** | **Close as superseded** — duplicate escpos validation only; do **not** merge (same logic as #910 tip commit) |
| 4 | `cursor/merchant-tdz-fix-2-1b4f` | **Do not merge** for print validation — stale base; only #910 dashboard delta is needed |

After merge: run production deploy workflow (or your usual `main` → prod path). GitHub Actions may be blocked by billing; pushes and manual deploy still apply the bits.

## Pre-deploy verification (CI or local)

```bash
cd dashboard
node --experimental-strip-types src/lib/escpos-payload.test.mjs
node --experimental-strip-types src/lib/escpos-kitchen-cut.test.mjs
node --experimental-strip-types src/lib/print-agent-usb-lan-keep.test.ts
node --experimental-strip-types src/lib/webpos-kitchen-routing.test.ts
node --experimental-strip-types src/lib/panel-mobile-keyboard.test.ts
cd ../backend
node --experimental-strip-types src/lib/pos-print-settings.kitchen-routing.test.ts
npm run build   # dashboard — commit dashboard/dist when dashboard src changes
```

Note: `settingsSearch.test.ts` may report **2 known failures** unrelated to this rollout; escpos/kitchen/USB tests should be green.

## Tablet rollout checklist

### A. Bridge APK (#912 on main)

- [ ] Install latest **Print Bridge** APK from merchant Settings → Receipts (or superadmin downloads).
- [ ] Open Bridge once after install; grant notification permission if prompted.
- [ ] Confirm Bridge shows **Connected** / local HTTP agent reachable from WebPOS (same device).

### B. WebPOS bundle (#910)

- [ ] On the tablet browser: **hard refresh** WebPOS (or clear site data for `app.rebornsense.com`).
- [ ] Open **Web POS** → confirm no **stuck top gap** after opening **Settings** (gear) and returning to POS.
- [ ] Open Settings → focus a text field → dismiss keyboard → POS layout should not stay vertically offset (`panel-mobile-keyboard` + `PosViewportManager`).

### C. USB receipt printer

- [ ] Settings → Printers: USB receipt printer selected; note `usb:VID:PID` id.
- [ ] If a **removed LAN** printer was saved before: USB profile must **not** be replaced by stale LAN host (reconcile on agent refresh).
- [ ] Test print from Settings; kitchen ticket from POS (mock agent OK in dev).

### D. USB scale (Bridge + WebPOS)

- [ ] Settings → Scale: scan ports via Bridge; save **USB scale address** (`usb:VID:PID`).
- [ ] In WebPOS weighted item flow: first read calls `GET /scale/reading?usbAddress=…` (sets Bridge **monitored scale** per `USB-PERMISSIONS-POS-PARITY.md`).
- [ ] If permission missing: tap Bridge notification → allow USB → replug or retry read.
- [ ] Reboot tablet with scale plugged: **one** scale allow on first Bridge foreground (not every resume).

### E. Reboot / replug regression (from parity doc)

- [ ] Reboot + saved USB printer → single allow on first Bridge open.
- [ ] Unplug → replug printer within 10s → allow dialog appears (debounce must not block replug).
- [ ] Random USB wedge attached → **no** Bridge prompt.
- [ ] Print from WebPOS with Bridge in background → notification opens allow flow if needed.

### F. Kitchen behavior (#910)

- [ ] Deselected drink/modifier lines do **not** print on kitchen tickets.
- [ ] No **double header** on kitchen tickets (provisional vs final header).
- [ ] Cash drawer kick and TSPL label jobs pass agent validation (`isValidAgentRawPrintBase64`).

## Single source for print payload validation

Use **`isValidAgentRawPrintBase64`** in `dashboard/src/lib/escpos-payload.ts` (imported from `print-agent.ts` and `webpos-print-queue.ts`). Do not reintroduce a second validator on another branch.

## References

- `print-agent-android/docs/USB-PERMISSIONS-POS-PARITY.md`
- `print-agent-android/README.md` — `/scale/ports`, `/scale/reading`
