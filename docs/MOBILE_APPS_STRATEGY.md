# Mobile apps strategy (Chaslay → rebornSense)

Assessment of Chaslay native mobile apps and how rebornSense can reuse design patterns while keeping our backend for catalog, settings, and orders.

## What exists in Chaslay (external repo)

The [Chaslay](https://github.com/ihtxam/Chaslay) monorepo (private) historically included:

| App | Purpose |
|-----|---------|
| **Android POS** (`pos-android`) | Full register, kitchen sync, floor plans |
| **Merchant mobile** | Accept/print online orders without full POS |
| **Customer apps** | Branded shop ordering (iOS/Android) |

Only the **Craft.js page builder** admin module was imported into rebornSense so far. See [CHASLAY_PAGEBUILDER_IMPORT.md](./CHASLAY_PAGEBUILDER_IMPORT.md).

Storefront renderer, customer native shells, and merchant order-only native apps were **not** copied.

## What exists in rebornSense today

| Surface | Path / package | Backend |
|---------|----------------|---------|
| **Android POS** | `app/` (`com.chaslay.pos`) | `/v1/*` via `chaslay-compat.service.ts` |
| **Web POS** | `/merchant/pos` | `/api/merchant/*` |
| **Waiter app** | `/merchant/waiter` | Same |
| **Online shop (PWA)** | `/shop/:slug` | `/api/shop/*` |
| **QR table ordering (PWA)** | `/shop/:slug/table/:id` | `/api/shop/*` + table sessions |
| **Merchant Order Hub (PWA)** | `/merchant/order-hub` | `/api/merchant/orders` |
| **Chaslay page builder (beta)** | `/merchant/chaslay-page-builder` | `/api/merchant/chaslay-pagebuilder` |

Merchants who use **shop + ordering only** (no POS) can install the dashboard as a PWA on a phone/tablet and use **Order hub** for accept/reject + kitchen print via till relay.

## Can we reuse Chaslay customer app design with our backend?

**Yes, with a thin native shell or PWA — not a full Chaslay backend port.**

### Recommended approach

1. **Short term — responsive shop PWA (already live)**  
   - Same UX patterns as Chaslay customer apps: menu, cart, checkout, table QR, order tracking.  
   - All product data, modifiers, pricing, visibility channels, and merchant settings come from rebornSense `/api/shop/*`.  
   - CMS theme + OpenPage homepage; optional Chaslay Craft.js pages when storefront renderer is wired.

2. **Medium term — branded Capacitor / TWA wrapper**  
   - Wrap `/shop/:slug` in a minimal Android/iOS shell (splash, icons, push notifications).  
   - No duplicate catalog API — only rebornSense backend.  
   - Deep links: `https://app.rebornsense.com/shop/{slug}/table/{id}?s={signedToken}`.

3. **Merchant orders-only native app**  
   - **Prefer PWA Order hub** (`/merchant/order-hub`) over maintaining a separate native merchant app.  
   - Android POS already receives `incomingOrders` via sync for merchants using POS.  
   - If a native shell is required later, point WebView at Order hub + till print bridge.

### Android POS compatibility notes

- Catalog sync now respects **per-channel visibility** (`pos` channel only on `/v1/sync/bootstrap`).  
- POS session register accepts optional **`locationId`** for multi-location scoping.  
- Package id remains `com.chaslay.pos`; API is rebornSense-hosted.

## Multi-location + mobile

- Staff pick active location in dashboard header (`X-Location-Id`).  
- QR table URLs include signed `?s=` tokens (`GET /merchant/floor-plans/table-access-tokens`).  
- Pay-at-table uses Adyen session on open table session (`POST .../table/:id/payment-session`).

## What would require importing from Chaslay repo

When the Chaslay repo is accessible, these are the highest-value UI-only imports (still backed by rebornSense APIs):

| Chaslay source | rebornSense target | Notes |
|----------------|-------------------|--------|
| `storefront/components/homepage-renderer/` | Shop homepage | Wire to `chaslay_homepage_builders` active page |
| Customer app theme tokens | `ShopThemeShell` / CMS | Map to existing shop theme hooks |
| Merchant order notification UI | `MerchantOrderHub.tsx` | Already started as PWA |

Do **not** import Chaslay Laravel `back-api` product or order models — map to existing `product.service`, `order.service`, `shop.routes`.

## Summary

| Question | Answer |
|----------|--------|
| Merchant app without POS? | **Order hub PWA** + shop backend |
| Customer app same design, our backend? | **Yes** — shop PWA today; optional native wrapper later |
| Chaslay page builder? | **Imported** (beta); storefront render still OpenPage |
| Android POS? | **In-repo**; syncs rebornSense `/v1` |
