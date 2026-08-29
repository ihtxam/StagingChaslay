# Multi-Location, HQ Menu, Channel Visibility & QR Ordering — Roadmap

> **Status:** Phase 1–5 foundation shipped (2026-08-29). HQ sync and bulk pricing are beta; polish continues.  
> **Saved:** 2026-08-28  
> **Purpose:** Capture product/architecture decisions from stakeholder discussions for future development.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Current platform state](#2-current-platform-state)
3. [Multi-location model](#3-multi-location-model)
4. [HQ headquarters (OrderPin-inspired)](#4-hq-headquarters-orderpin-inspired)
5. [Bulk pricing changes](#5-bulk-pricing-changes)
6. [Channel visibility (products & categories)](#6-channel-visibility-products--categories)
7. [QR table ordering](#7-qr-table-ordering)
8. [Licensing model](#8-licensing-model)
9. [Phased implementation plan](#9-phased-implementation-plan)
10. [Open product decisions](#10-open-product-decisions)
11. [Reference links](#11-reference-links)

---

## 1. Executive summary

A merchant may operate **multiple locations** (e.g. one retail shop + one restaurant, or five restaurants). Today the platform is **one merchant account = one business = one location**.

The target experience:

- **One login** for the owner
- **Location picker** when opening POS or back office
- Each location has **fully separate** sales, reports, inventory, terminals, and staff scope
- An optional **HQ (Headquarters)** layer for shared catalog/menu management across locations
- **Bulk pricing** tools at HQ or location level (%, fixed amount, by category or selection)
- **Per-channel visibility** for products/categories (POS, online shop, QR dine-in, delivery, etc.)
- **QR table ordering** linked to floor plan — customer scans, orders, manager approves, kitchen receives, customer can add more and pay

Inspired in part by [OrderPin HQ Menu](https://helpcenter.orderpin.co/docs/What-is-HQ-Menu) — centralized menu control with push-to-store sync and local override flexibility.

---

## 2. Current platform state

| Area | Today |
|------|-------|
| Tenancy | `merchants` row = org; **locations** table + default backfill per merchant |
| Locations | `locations`, `merchant_staff_locations`, `location_id` on `orders` + `pos_sessions` |
| Business type | Per-location `business_category` (retail \| restaurant) |
| POS licensing | Concurrent seats via `max_pos_posts` / `max_waiter_posts` + `pos_sessions` |
| Location licensing | `max_locations` on plan + `extra_location` add-on enforced |
| Table QR | Customer PWA at `/shop/:slug/table/:id`; session + pending approval flow |
| Channel visibility | `visibility.channels` on products & categories; POS/shop/QR filters |
| HQ catalog | `hq_catalog_versions`, push to locations, `location_catalog_links` |
| Bulk pricing | Preview/apply wizard at `/merchant/hq/bulk-pricing` |

**Key files today:**

- Schema: `backend/src/db/schema.ts`
- POS sessions: `backend/src/services/pos-sessions.service.ts`
- Business module gating: `dashboard/src/lib/business-module.ts`, `backend/src/middleware/business-module.middleware.ts`
- Table QR (codes only): `backend/src/services/table-qr.service.ts`, `dashboard/src/pages/merchant/tables/TableQrCodes.tsx`
- Subscription add-ons: `extra_pos_post`, `extra_waiter_post` in `subscription-addons.service.ts`

---

## 3. Multi-location model

### Recommended hierarchy

```
Organization (merchants — billing, owner login, optional HQ)
    ├── Location A (Retail shop)
    │       ├── POS sessions, orders, stock, reports, terminals
    │       └── Store menu (local + synced from HQ)
    ├── Location B (Restaurant)
    │       └── ...
    └── Location C (Restaurant)
            └── ...
```

### UX flow

1. Owner/staff logs in once
2. If **one location** → auto-select (no friction)
3. If **multiple locations** → **location picker** (name, type badge, address)
4. Click **POS** → choose location → enter WebPOS scoped to that location only
5. **Switch location** explicitly (confirm if cart open)
6. Back office: org-wide dashboard + per-location drill-down

### Schema (foundation)

**New table: `locations`**

| Column | Notes |
|--------|-------|
| `id`, `merchant_id` | PK, FK |
| `name`, `slug` | Display + URL segment |
| `business_category` | `retail` \| `restaurant` per location |
| `address`, `city`, `country`, `timezone` | |
| `is_default`, `status` | |
| `settings` (jsonb) | Tax, hours, print, checkout per location |

**Add `location_id` to operational tables** (phased):

| Priority | Tables |
|----------|--------|
| P0 | `orders`, `pos_sessions`, `payment_terminals` |
| P1 | `inventory_*`, `floor_plans`, `dining_tables`, `kds_stations`, `shifts` |
| P2 | `products` (or location price/stock overlay table) |

**Staff scoping:** `merchant_staff_locations` junction — manager → all; cashier → Location A only.

**Migration:** Create default location per existing merchant from current address + `business_category`; backfill `location_id`; nullable → required on new writes.

**Settings split:**

- **Org-level** (on `merchants`): subscription, billing, reseller, shared catalog master (optional)
- **Location-level**: tax, hours, printers, terminals, channels, floor plan

---

## 4. HQ headquarters (OrderPin-inspired)

### What OrderPin does (reference)

From [OrderPin HQ Menu docs](https://helpcenter.orderpin.co/docs/What-is-HQ-Menu):

- **HQ Menu** — centralized menu; HQ pushes to selected stores; consistency across franchise/chain
- **Store Menu** — managed locally; cannot sync across stores
- HQ sidebar differs from store sidebar
- HQ menu setup: name, effective time windows, sales channels, **select which stores**, select products, **synchronize**
- Synced menus appear in store with **"From HQ"** label; disabled by default until store enables

### Proposed Reborn HQ model

| Concept | Description |
|---------|-------------|
| **HQ mode** | Top-level back-office context when org has 2+ locations |
| **HQ catalog** | Master products, categories, modifiers, combos — not tied to one location's sales |
| **Push / sync** | HQ publishes menu snapshot → selected locations receive copy |
| **"From HQ" badge** | Location catalog shows HQ-sourced items; local manager can enable/disable or override |
| **Override rules** | Location can change **price**, **availability**, **channel visibility** without breaking HQ link; structural changes (name, modifiers) optionally locked or flagged |
| **Two-way workflow** | Edit at HQ → push to N locations; OR edit at location → stays local unless "promote to HQ" |

### HQ sidebar (additional entries)

- **HQ Dashboard** — cross-location sales summary
- **HQ Catalog** — products, categories, modifiers, combos (master)
- **HQ Menus** — time-based menus (breakfast/lunch) + channel assignment (like OrderPin)
- **Sync to locations** — pick locations, preview diff, apply
- **Bulk pricing** — see §5
- **Locations** — manage branches, licenses, defaults

### Store-level sidebar (when drilled into a location)

- Same as today but scoped to `location_id`
- Catalog shows HQ-synced items with badge
- Reports, orders, inventory, floor plan — location only

### Sync mechanics (technical sketch)

```
hq_catalog_versions (id, merchant_id, version, payload_json, created_at)
location_catalog_links (location_id, hq_product_id, local_product_id, sync_status, overrides_json)
```

- **Full sync** — replace location menu from HQ template (with confirm)
- **Incremental sync** — add new HQ items; optional price overwrite policy
- **Conflict policy** — HQ wins / location wins / manual review per field

---

## 5. Bulk pricing changes

### User story

> "Increase all prices in Store A by CHF 2" or "Increase Category 'Beverages' by 2% across Locations B and C."

### UI flow (wizard)

1. **Scope**
   - All products at location / selected locations / HQ master
   - OR filter by category (one or many)
   - OR manual multi-select (existing product select-all pattern)
2. **Preview** — list affected SKUs with current → new price
3. **Operation**
   - Increase / decrease
   - By **fixed amount** (e.g. +2.00 CHF) or **percentage** (e.g. +2%)
   - Optional: round to nearest 0.05 / 0.10
4. **Confirm** — typed confirmation for large batches (reuse bulk-delete modal pattern)
5. **Apply** — batch update; audit log entry

### Rules

- Respect location-specific price overlays (if product linked from HQ, update `overrides_json.price` or local price field)
- Sizes/specifications: apply per size row or base price only (configurable)
- Modifiers/add-ons: optional include/exclude
- **Audit:** `pricing_bulk_jobs` table — who, when, scope, operation, count affected

### API sketch

```
POST /merchant/hq/bulk-pricing/preview  { locationIds, categoryIds?, productIds?, operation, value, valueType }
POST /merchant/hq/bulk-pricing/apply    { previewToken }
```

---

## 6. Channel visibility (products & categories)

### Requirement

Control where each product/category appears:

| Channel | Code | Description |
|---------|------|-------------|
| POS / WebPOS | `pos` | In-store register |
| Online shop | `shop` | Public web shop |
| QR dine-in | `qr_table` | Customer table QR ordering |
| Delivery platforms | `delivery` | Uber Eats / Deliveroo / etc. |
| Kiosk (future) | `kiosk` | Self-service terminal |
| All | `*` | Default — visible everywhere enabled |

### Schema sketch

**Products:**

```json
"visibility": {
  "channels": ["pos", "shop", "qr_table"],
  "hiddenOn": []
}
```

**Categories:** same pattern; products inherit unless overridden.

**Location override:** `location_product_overrides.visibility` can narrow (not widen without HQ permission).

### UI

- Product edit: checkboxes or multi-select chips — "Visible on"
- Category edit: same + "Apply to all products in category"
- Catalog list: filter by channel
- HQ sync: channel rules part of HQ template

### Current gap

No `visibility` or `sales_channels` fields on products/categories today. Online shop and POS currently show same catalog (minus out-of-stock).

---

## 7. QR table ordering

### Requirement (full flow)

1. **Setup** — In floor plan / table management: select table → generate **customer QR** (static per table)
2. **Scan** — Customer opens mobile web menu for that table + location
3. **Order** — Browse menu (filtered by `qr_table` visibility), add to cart, submit
4. **Approval** — Order appears on POS as **pending**; manager approves → sent to kitchen (KDS)
5. **Add more** — Same QR session; customer sees **already ordered items** + can add more rounds
6. **Pay** — Customer pays bill at end (Stripe / Twint / etc.) OR pay at counter (staff closes table)

### What exists today

| Feature | Status |
|---------|--------|
| Floor plan & tables | ✅ |
| Table QR code generation (PNG, styles) | ✅ `TableQrCodes.tsx`, `table-qr.service` |
| Waiter QR (staff assigns table at POS) | ✅ Partial |
| Customer-facing table menu URL | ❌ |
| QR order submission → POS pending | ❌ |
| Manager approval workflow | ❌ |
| Session persistence (re-scan, see history) | ❌ |
| Table payment / split bill from QR | ❌ |

### Proposed architecture

```
Customer phone (PWA / shop subdomain)
    → GET /shop/:slug/table/:tableToken/menu
    → POST /shop/:slug/table/:tableToken/orders  (status: pending_approval)
POS / WebPOS
    → GET /merchant/orders?source=qr_table&status=pending_approval
    → POST approve → KDS + table order link
Table session
    → table_sessions (table_id, session_token, opened_at, status)
    → orders.table_session_id
```

**QR payload:** Signed URL token — `https://app.example.com/t/{locationSlug}/{tableId}?s={sessionOrStaticToken}`

**Security:**

- Token binds to location + table (no cross-table ordering)
- Rate limiting on anonymous order POST
- Optional: require table PIN for payment only

**Integration with visibility:** Only products with `qr_table` channel appear in customer menu.

**Settings (per location):**

- Auto-approve vs manager approval
- Allow pay-at-table vs pay-at-counter only
- Menu effective hours (link to HQ Menu time windows)

---

## 8. Licensing model

Separate limits for **locations** vs **POS seats**:

| Limit | Meaning | Today | Proposed |
|-------|---------|-------|----------|
| **Locations** | Shops/branches org can create | Not enforced | `max_locations` on plan |
| **POS seats** | Concurrent registers | `max_pos_posts` | Keep; per-location or org pool |
| **Waiter seats** | Concurrent waiter stations | `max_waiter_posts` | Keep |
| **Staff** | Back-office users | `max_staff` | Org-wide |

**Add-ons (mirror `extra_pos_post`):**

- `extra_location` → +1 location
- `extra_pos_post` → +1 concurrent register
- `extra_waiter_post` → +1 waiter station

**Enforcement:**

- Create location → `active_locations < max_locations`
- Register POS session → include `location_id`; check seat pool
- Billing UI: "2 / 3 locations", "3 / 4 POS seats in use"

**Example merchant:** Professional (1 location, 2 POS) + `extra_location` ×1 + `extra_pos_post` ×2 → 2 locations, 4 POS seats.

---

## 9. Phased implementation plan

> **Not starting today.** Ordered by dependency.

### Phase 0 — Documentation & decisions (this document)

- [x] Capture requirements
- [x] Phase 1–5 foundation implemented (see commit on `cursor/multi-location-foundation-8f5f`)

### Phase 1 — Multi-location foundation

- [x] `locations` table + default location migration
- [x] `location_id` on `orders`, `pos_sessions`
- [x] Location picker + header switcher (`X-Location-Id`)
- [x] Reports filtered by location (EOD query param + header)
- [x] `max_locations` plan field + `extra_location` add-on
- [x] Staff ↔ location permissions (`merchant_staff_locations`)

**Outcome:** Two real shops under one account, separate sales.

### Phase 2 — Channel visibility

- [x] `visibility.channels` on products & categories
- [x] UI in Products / Categories edit
- [x] POS, shop, and QR menu respect flags
- [x] Catalog list channel filter (Products page)
- [ ] Location overrides (partial — `location_product_overrides` table + bulk pricing path)

**Outcome:** Hide barcodes-only retail items from restaurant POS, etc.

### Phase 3 — HQ catalog & sync

- [x] HQ back-office pages (`/merchant/hq`)
- [x] Master catalog snapshot + push to selected locations
- [x] `location_catalog_links` + "From HQ" link records
- [ ] HQ menus with effective times + channel assignment (OrderPin-style)
- [ ] Full storefront renderer wiring

**Outcome:** One menu update → all restaurants (beta).

### Phase 4 — Bulk pricing

- [x] Preview/apply wizard
- [x] Category / all-products scope
- [x] % and fixed amount; audit log (`pricing_bulk_jobs`)
- [x] Works at HQ level; location-scoped via overrides

**Outcome:** "Increase all beverages 2%" in one action.

### Phase 5 — QR table ordering

- [x] Customer table menu PWA
- [x] Order → pending approval → POS → KDS
- [x] Session persistence (re-scan, order history)
- [x] QR auto-approve → kitchen fix
- [ ] Pay at table (payment integration)
- [ ] Signed URL tokens + rate limiting

**Outcome:** Full dine-in QR ordering (core flow live).

### Phase 6 — Polish & enterprise

- Cross-location inventory transfers
- Org-wide analytics dashboard
- Per-location online shop URLs
- Android Print Bridge per location

---

## 10. Open product decisions

| # | Question | Options |
|---|----------|---------|
| 1 | POS seat pool | Org-wide (simpler) vs per-location (fairer) |
| 2 | Catalog sharing | Fully separate per location vs shared master + overrides |
| 3 | HQ override policy | HQ always wins vs location can diverge on price/availability |
| 4 | QR orders | Auto-approve vs manager approval default |
| 5 | QR payment | Pay on phone vs pay at counter only (v1) |
| 6 | Online shop | One subdomain + location selector vs subdomain per location |
| 7 | Retail + restaurant mix | Same org allowed (recommended) vs separate orgs |
| 8 | Bulk pricing on modifiers | Include add-on prices in bulk job? |

---

## 11. Reference links

- [OrderPin — What is HQ Menu?](https://helpcenter.orderpin.co/docs/What-is-HQ-Menu)
- [OrderPin Help Center — HQ search](https://helpcenter.orderpin.co/search?keyword=HQ&content_ids=)
- Internal: `docs/UNIFIED_SETTINGS.md`, `docs/DELIVERY-PLATFORMS.md`
- Internal: `print-agent-android/README.md` (per-location print bridge, future)
- Table QR (current): `dashboard/src/pages/merchant/tables/TableQrCodes.tsx`

---

## Appendix — Discussion log (2026-08-28)

### Multi-location (earlier thread)

- Merchant with retail + restaurant needs two POS worlds under one login
- Pick location before POS; each location isolated for sales/exports/reports
- Licensing: `max_locations` + `extra_location` add-on, separate from POS seats
- Interim: two merchant accounts until Phase 1

### HQ & OrderPin (this thread)

- HQ menu for chains with same menu across locations
- Copy/sync from HQ to locations; local managers can adjust pricing/menu per store
- Bulk pricing: whole store or category, +2 CHF or +2%, with preview step
- OrderPin pattern: HQ push, "From HQ" label, store enables locally

### Channel visibility & QR ordering (this thread)

- Product/category visible on: POS only, shop only, QR only, all, etc.
- QR ordering linked to table plan: generate QR per table, customer orders, manager approves, kitchen receives
- Customer can re-scan to add items, see order history, pay at end
- QR ordering not built yet; table QR codes exist for staff/waiter use today

### Explicit scope note

> **Implementation deferred** — plan saved for later stage, not scheduled for current sprint.
