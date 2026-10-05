# QA checklist — features merged to `main` (~last 5 days)

Use **staging** first: [app.chaslay.com](https://app.chaslay.com) · shop hub e.g. [shop.chaslay.com](https://shop.chaslay.com)  
Then **production** after sign-off: [app.rebornsense.com](https://app.rebornsense.com)

**Not on staging/prod until merged:** POS create-customer + membership (#644), POS tills / printer routing (#645) — see [tester-pos-tills-and-customers.md](./tester-pos-tills-and-customers.md) on those branches.

---

## Shop — offers & cart

| # | What to test | Where |
|---|----------------|-------|
| 1 | **Cart minimum free gift tiers** — offer adds free product when cart subtotal crosses tier(s) | Shop checkout, merchant Offers |
| 2 | **Multiple cart-gift campaigns** — more than one free-gift rule; currency-aware minimum amounts | Same |
| 3 | **Free-gift badge** on menu / cart when offer applies | Shop menu, cart |
| 4 | **Dietary filters** — filter menu by dietary labels | Public shop menu |
| 5 | **Product dietary label checkboxes** in merchant catalog | Products → edit product |
| 6 | **Shop stays up** when loyalty/rewards API fails (menu still loads) | Shop with rewards misconfigured / offline rewards |

## Shop — menus & scheduling

| # | What to test | Where |
|---|----------------|-------|
| 7 | **Scheduled menus** — categories/products appear only in configured time windows | Shop menu by time of day |
| 8 | **Time-based category visibility** on online menu | Shop settings / categories |
| 9 | **Time-slot product pricing** — different prices by slot on shop (and POS where wired) | Products → time slots; shop prices |
| 10 | **Excel import/export** for time-slot prices | Products → More options |

## Shop — catalog & channels

| # | What to test | Where |
|---|----------------|-------|
| 11 | **Delivery folded into online shop channel** — one “online shop” channel instead of separate delivery channel | Catalog / channel settings |
| 12 | **Demo Food Truck** default location type **retail** on fresh demo | Demo merchant |

## Shop — gift cards & catering

| # | What to test | Where |
|---|----------------|-------|
| 13 | **Gift card themes**, delivery fees, **PDF download** | Shop gift cards |
| 14 | **Flexible catering packages** with guest-scoped add-ons | Catering shop flow |
| 15 | **Tier slot / per-person pricing** (Salsarita-style bars) | Catering packages |
| 16 | **Catering best-class UI** — guide, modal offers, CDS-related fields | Catering builder / checkout |

## Shop — multi-location hub

| # | What to test | Where |
|---|----------------|-------|
| 17 | **Multi-location shop hub wizard** | Merchant onboarding / shop hub |

## POS / WebPOS

| # | What to test | Where |
|---|----------------|-------|
| 18 | **Reservations auto-accept** toggle on bookings view | POS reservations |
| 19 | **Menu text size** on browsers **without CSS zoom** | POS gear → display |
| 20 | **Express checkout** — arrow hidden when express buttons disabled | WebPOS checkout |
| 21 | **Order channel toggles** in POS gear + merchant-level enforcement (WebPOS/kiosk) | Settings + POS gear |
| 22 | **Compact PIN gate** on 6″ landscape tablets | PIN login |
| 23 | **Terminal tips** update total; non-taxable tips on receipt VAT | Pay at terminal |
| 24 | **Receipt header** — store name, address, phone on **separate lines** | Print receipt |
| 25 | **Offer strings i18n** on POS where added | POS offers UI |

## Fiscal (DE)

| # | What to test | Where |
|---|----------------|-------|
| 26 | **Fiskaly DE** TSS provisioning, **POS sale signing**, **receipt QR** | DE merchant fiscal settings + sale |

## Accounting add-ons

| # | What to test | Where |
|---|----------------|-------|
| 27 | **Bexio / Odoo** add-ons, period export, OAuth / API push (phase 2) | Settings → accounting |

## Bridge / Android

| # | What to test | Where |
|---|----------------|-------|
| 28 | **Bridge APK 0.4.28** install/update | Android device |
| 29 | **Boot autostart** + WebPOS bridge probe | Bridge app |
| 30 | **PWA scanner wedge** on Android WebPOS | Scan barcode in WebPOS |

## Platform / footer

| # | What to test | Where |
|---|----------------|-------|
| 31 | **Powered by Reborn** footer (shop / panel as applicable) | Public pages |
| 32 | **Onboarding** — payment step marks complete when POS methods saved; progress after nav | Merchant onboarding |

## Deploy / stability fixes (smoke)

| # | What to test | Notes |
|---|----------------|-------|
| 33 | **Catalog restore** when product columns missing | Merchant catalog loads (prod fix) |
| 34 | **Production deploy** completes if Windows installer fetch fails | Ops — deploy logs only |
| 35 | **Mailco SPF/DMARC** checklist doc | Docs #615 — DNS only |

---

## Quick smoke (every deploy)

1. **Panel:** `GET /api/health` → OK; login; open Dashboard, Products, Settings, Orders.
2. **Shop:** Home/menu loads; add to cart; checkout first step (no need to pay).
3. **POS:** WebPOS loads; PIN gate; register view; open gear settings.

Staging health: `https://app.chaslay.com/api/health`  
Production health: `https://app.rebornsense.com/api/health`
