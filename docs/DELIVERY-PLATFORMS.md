# Delivery platforms (Just Eat & Uber Eats)

Connect aggregator orders into Reborn POS alongside your own online shop. Orders share the same kitchen workflow, WebPOS online panel, and auto-print pipeline.

## What works today

| Area | Status |
|------|--------|
| Settings → **Delivery platforms** tab | Credentials, test/production mode, webhook URLs |
| DB | `merchants.delivery_platform_settings`, `orders.order_source`, `orders.external_order_id` |
| Production webhooks | `POST /api/webhooks/just-eat/:merchantId/...`, `POST /api/webhooks/uber-eats/:merchantId` |
| Just Eat (JET Connect) | `order-ready-for-preparation-sync`, `-async`, `acceptance-requested` |
| Signature verification | Just Eat: `X-JET-Connect-Hash` + optional `Authorization`; Uber: `X-Uber-Signature` |
| Payload mapping | JET Connect `order-ready-for-preparation` + Uber `orders.notification` (API enrichment) |
| Test ingest | `POST /api/webhooks/delivery-platforms/:platform/:merchantId/test` (**test mode only**) |
| Accept callback | Accept in Orders/WebPOS → partner accept API (best-effort) |
| Order channel enum | `online_shop`, `justeat`, `ubereats` |
| Auto-print | Backend enqueues `auto_print_order` → WebPOS main till + Print Agent |

## Migration

```bash
psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql
```

Hetzner deploy runs this automatically via `scripts/deploy-hetzner.sh`.

---

## Do this RIGHT NOW

### Uber Eats (you have test credentials today)

1. Open **Settings → Delivery platforms → Uber Eats**
2. **Enable integration** → ON  
3. Paste your **test** credentials:
   - **Store / restaurant ID** — Uber Eats store UUID  
   - **Client ID** — OAuth client ID from Uber Developer Dashboard  
   - **Client secret** — OAuth client secret  
   - **Webhook secret** — from Uber webhook configuration (used for `X-Uber-Signature`)
4. Leave **Test mode** ON while using sandbox credentials (turns off automatically when production client ID + secret are saved).
5. **Save**, then copy the **Webhook URL** shown on the tab:
   ```
   https://app.rebornsense.com/api/webhooks/uber-eats/{MERCHANT_UUID}
   ```
6. In [Uber Developer Dashboard](https://developer.uber.com/) → your Eats app → **Webhooks**, register that URL and subscribe to **`orders.notification`**.
7. Place a **test order** on your linked Uber Eats sandbox store. It should appear in **Orders** / **WebPOS** within seconds and auto-print if kitchen printing is enabled.

### Just Eat — JET Connect (no partner form wait)

Just Eat pointed you to the self-service docs: **[JET Connect API](https://uk.api.just-eat.io/docs/jetconnect/index.html)**

1. Sign in to the **JET Connect / Just Eat developer portal** (credentials from your onboarding email).
2. Note these values from the portal:
   - **Restaurant ID** (`Restaurant.Id` in order payloads)
   - **API key** — partner REST key (`JE-API-KEY` for outbound calls like accept)
   - **Webhook Authorization key** (optional) — exact `Authorization` header value on inbound webhooks
   - **Webhook HMAC secret** — used to compute `X-JET-Connect-Hash`
3. In **Settings → Delivery platforms → Just Eat**:
   - **Enable integration** → ON  
   - **Restaurant ID** → paste store id  
   - **JET Connect API key** → REST API key  
   - **Webhook Authorization key** → optional inbound auth key  
   - **Webhook HMAC secret** → HMAC secret (**required** for live signed webhooks)
4. **Save**, copy the **webhook base URL**:
   ```
   https://app.rebornsense.com/api/webhooks/just-eat/{MERCHANT_UUID}
   ```
5. In JET Connect portal → **Webhook subscription**, register that **base URL** (no path suffix). Just Eat POSTs to:
   - `{base}/order-ready-for-preparation-sync` (sync — return HTTP 200)
   - `{base}/order-ready-for-preparation-async` (async — return HTTP 202 + callback)
6. Subscribe at minimum to **`order-ready-for-preparation-sync`** (or async if your contract requires it).
7. Send a **sandbox test order** (`IsTest: true` in payload) or use Reborn test mode + `/test` endpoint below.

**Reborn field mapping (Just Eat)**

| Reborn Settings field | JET Connect portal / docs |
|------------------------|---------------------------|
| Store / restaurant ID | `Restaurant.Id` |
| JET Connect API key | Partner REST API key (`JE-API-KEY`) |
| Webhook Authorization key | Webhook `Authorization` header value (optional) |
| Webhook HMAC secret | Webhook signing secret → `X-JET-Connect-Hash` |

---

## Partner API approval — what it is

**Partner API approval** means Just Eat / Uber Eats has approved your restaurant (and integration app) to receive **live** orders via their official APIs — not sandbox/test traffic.

Until live approval:

- Use **Test mode** in Reborn and the `/test` webhook endpoint, **or**
- Use partner **sandbox / test stores** (Uber test creds; Just Eat orders with `IsTest: true`).

After live approval:

- Save **production credentials** in Settings (test mode turns off automatically when required fields are saved).
- Register the **production webhook URLs** in the partner portal.
- Configure **webhook signing secrets**.

Your own **online shop** (`order_source: online_shop`) is unchanged and does not require partner approval.

---

## Step-by-step: Just Eat (JET Connect)

Docs: [https://uk.api.just-eat.io/docs/jetconnect/index.html](https://uk.api.just-eat.io/docs/jetconnect/index.html)

### 1. Get credentials from JET Connect portal

No separate “assistance form” wait — onboarding credentials and webhook setup are in the JET Connect docs / developer portal.

Collect:

- Restaurant ID  
- API key (REST / `JE-API-KEY`)  
- Webhook HMAC secret  
- Webhook Authorization key (if configured on Just Eat side)

**Sandbox vs production**

| | Sandbox / test | Production |
|---|----------------|------------|
| API base | `https://uk-partnerapi.just-eat.io` (override via `JET_CONNECT_SANDBOX_API_BASE`) | `https://uk-partnerapi.just-eat.io` |
| Orders | Payloads with `IsTest: true` | Live customer orders |
| Reborn | Test mode ON, or live creds + signed webhooks | Test mode OFF when API key + webhook HMAC secret saved |

### 2. Configure Reborn

**Settings → Delivery platforms → Just Eat**

| Field | What to enter |
|-------|----------------|
| Enable integration | On |
| Store / restaurant ID | JET Connect `Restaurant.Id` |
| JET Connect API key | Partner REST API key |
| Webhook Authorization key | Optional inbound `Authorization` header value |
| Webhook HMAC secret | Webhook signing secret (**required for live**) |
| Auto-accept orders | Optional — skip manual approval; Reborn calls `PUT /orders/{id}/accept` |
| Test mode | Off automatically when API key + webhook HMAC secret are saved |

### 3. Register webhook base URL

Copy from Settings (replace `{MERCHANT_UUID}` with your merchant id):

```
https://app.rebornsense.com/api/webhooks/just-eat/{MERCHANT_UUID}
```

In JET Connect, subscribe to order webhooks. Just Eat appends paths, e.g.:

| Event | Method + path | Reborn response |
|-------|---------------|------------------|
| Order ready (sync) | `POST …/order-ready-for-preparation-sync` | HTTP 200 |
| Order ready (async) | `POST …/order-ready-for-preparation-async?callback=…` | HTTP 202 + success/failure callback |
| Acceptance requested | `POST …/acceptance-requested` | HTTP 200 |

**Webhook security (JET Connect)**

- `X-JET-Connect-Hash: <hex>` — HMAC-SHA256 of the **raw JSON body** using your webhook HMAC secret  
- `Authorization: <webhook auth key>` — optional exact-match header if configured in portal

Legacy Flyt-style headers (`X-Flyt-Signature`, `X-JET-Signature`, `X-Webhook-Secret`) are still accepted when test mode is on.

### 4. Order payload (what Reborn maps)

Primary webhook: **`order-ready-for-preparation`** with fields such as:

- `OrderId` → external order id  
- `Restaurant.Id` → store id  
- `Fulfilment.Method` → `Delivery` / `Collection`  
- `Items[]` (nested, with `Reference` PLU/SKU)  
- `PriceBreakdown`, `TotalPrice`, `Customer`, `CustomerNotes`

Map partner item `Reference` values to **Products → SKU** in Reborn. Unmapped items still print by name.

### 5. Accept flow

When staff tap **Accept** on a Just Eat order in Reborn:

- **Just Eat:** `PUT https://uk-partnerapi.just-eat.io/orders/{OrderId}/accept` with `Authorization: JE-API-KEY {apiKey}`

---

## Step-by-step: Uber Eats (Eats API)

### 1. Register & get approved

1. Sign in to [Uber Developer Dashboard](https://developer.uber.com/)
2. Create an **Eats API** application (restaurant integration).
3. Request **production** access when ready — Uber reviews your use case and links your store(s).
4. In **Uber Eats Manager**, authorize the app for your location(s).
5. Note **Client ID**, **Client secret**, **Store ID**, and **Webhook secret**.

### 2. Configure Reborn

**Settings → Delivery platforms → Uber Eats**

| Field | What to enter |
|-------|----------------|
| Enable integration | On |
| Store / restaurant ID | Uber Eats store UUID |
| Client ID | OAuth client ID |
| Client secret | OAuth client secret |
| Webhook secret | From Uber webhook config (used for `X-Uber-Signature`) |
| Auto-accept orders | Optional |
| Test mode | Off automatically when client ID + secret are saved |

### 3. Register webhook URL

```
https://app.rebornsense.com/api/webhooks/uber-eats/{MERCHANT_UUID}
```

Subscribe to **`orders.notification`** (and related order release events per your Uber contract).

**Signature:** Uber sends `X-Uber-Signature: sha256=<hex>` — HMAC-SHA256 of the raw body using your webhook secret (falls back to client secret).

**Notification-only payloads:** Reborn fetches full order details via `GET /v1/eats/orders/{id}` when OAuth credentials are configured.

### 4. Accept flow

When staff tap **Accept** on an Uber Eats order:

- **Uber:** `POST /v1/eats/orders/{id}/accept_pos_order`

---

## Webhook URL format (all merchants)

| Platform | Base URL |
|----------|----------|
| Just Eat (JET Connect) | `https://app.rebornsense.com/api/webhooks/just-eat/{MERCHANT_UUID}` |
| Just Eat events (appended by JE) | `…/order-ready-for-preparation-sync`, `…/order-ready-for-preparation-async`, `…/acceptance-requested` |
| Uber Eats | `https://app.rebornsense.com/api/webhooks/uber-eats/{MERCHANT_UUID}` |
| Test (sandbox) | `https://app.rebornsense.com/api/webhooks/delivery-platforms/just-eat\|uber-eats/{MERCHANT_UUID}/test` |

`{MERCHANT_UUID}` is shown on the Delivery platforms settings tab (same as `merchants.id`).

---

## Test locally

```bash
# 1. Run SQL migration
psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql

# 2. Enable platform in Settings (test mode ON, enabled ON)

# 3a. Generic test ingest
curl -X POST "http://localhost:3000/api/webhooks/delivery-platforms/just-eat/<MERCHANT_UUID>/test" \
  -H "Content-Type: application/json" \
  -d '{"externalOrderId":"TEST-001","items":[{"name":"Fries","quantity":1,"unitPrice":6.5}],"total":6.5}'

# 3b. JET Connect-shaped test payload
curl -X POST "http://localhost:3000/api/webhooks/delivery-platforms/just-eat/<MERCHANT_UUID>/test" \
  -H "Content-Type: application/json" \
  -d '{"OrderId":"TEST-JET-001","IsTest":true,"Fulfilment":{"Method":"Delivery","PhoneNumber":"+441234567890","Address":{"Lines":["1 Test St"],"PostalCode":"SW1A 1AA","City":"London"}},"Customer":{"Name":"Test Guest"},"Items":[{"Name":"Burger","Quantity":1,"Reference":"SKU-1","UnitPrice":9.5,"TotalPrice":9.5,"Items":[]}],"PriceBreakdown":{"Items":9.5,"Taxes":0,"Fees":{"Delivery":1},"Tips":0},"TotalPrice":10.5,"Restaurant":{"Id":"99999"}}'
```

Order appears in **Orders** and **WebPOS** online panel. With Print Agent on the main till, kitchen/receipt jobs print within ~2.5s.

---

## Architecture

```
Partner webhook → map payload (JET Connect / Uber) → DeliveryPlatformService.ingestOrder()
  → orders (orderType=web_shop, orderSource=justeat|ubereats)
  → chaslay_floor_print_jobs (kind=auto_print_order)
  → WebPOS poll → external-order-auto-print.ts → Print Agent

Accept in UI → OrderService.applyOrderAction('accept')
  → DeliveryPlatformService.notifyPartnerOrderAccepted() → partner API
```

Online shop orders continue via `POST /api/shop/...` with `order_source: online_shop` — no webhook required.

---

## Environment variables (optional)

| Variable | Purpose |
|----------|---------|
| `JET_CONNECT_API_BASE` | Override Just Eat partner API base (default `https://uk-partnerapi.just-eat.io`) |
| `JET_CONNECT_SANDBOX_API_BASE` | Sandbox partner API base when test mode is on |
| `DELIVERY_PLATFORMS_ALLOW_TEST_WEBHOOKS` | Set `false` to require signatures even in test mode |

---

## Files

- `backend/sql/ensure-delivery-platforms.sql`
- `backend/src/lib/delivery-platform-settings.ts`
- `backend/src/lib/delivery-platform-webhook-mappers.ts`
- `backend/src/services/delivery-platform.service.ts`
- `backend/src/routes/delivery-platform.routes.ts`
- `dashboard/src/pages/merchant/settings/SettingsDeliveryPlatformsTab.tsx`
- `dashboard/src/lib/external-order-auto-print.ts`
- `docs/DELIVERY-PLATFORMS.md`

---

## Remaining hardening (optional)

- Encrypt `delivery_platform_settings` at rest
- Rate limiting on webhook routes
- Dead-letter queue for failed ingests
- Full JET Connect menu sync / item availability APIs
- Channel badges in Orders UI
