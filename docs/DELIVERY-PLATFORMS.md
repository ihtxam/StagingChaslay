# Delivery platforms (Just Eat & Uber Eats)

Connect aggregator orders into Chaslay POS alongside your own online shop. Orders share the same kitchen workflow, WebPOS online panel, and auto-print pipeline.

## What works today

| Area | Status |
|------|--------|
| Settings → **Delivery platforms** tab | Credentials, test/production mode, webhook URLs |
| DB | `merchants.delivery_platform_settings`, `orders.order_source`, `orders.external_order_id` |
| Production webhooks | `POST /api/webhooks/just-eat/:merchantId`, `POST /api/webhooks/uber-eats/:merchantId` |
| Signature verification | HMAC (`X-Signature`, `X-Uber-Signature`, `X-Flyt-Signature`, …) or shared secret header |
| Payload mapping | Just Eat Flyt-style + Uber `orders.notification` (with API enrichment when creds set) |
| Test ingest | `POST /api/webhooks/delivery-platforms/:platform/:merchantId/test` (**test mode only**) |
| Accept callback | When you **Accept** in Orders/WebPOS, Chaslay calls partner accept API (best-effort) |
| Order channel enum | `online_shop`, `justeat`, `ubereats` |
| Auto-print | Backend enqueues `auto_print_order` → WebPOS main till + Print Agent |

## Migration

```bash
psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql
```

Hetzner deploy runs this automatically via `scripts/deploy-hetzner.sh`.

---

## Partner API approval — what it is

**Partner API approval** means Just Eat / Uber Eats has approved your restaurant (and your integration app) to receive **live** orders via their official APIs — not sandbox/test traffic.

Until approval:

- Use **Test mode** in Chaslay and the `/test` webhook endpoint, **or**
- Ask your account manager for a **sandbox store** if the partner offers one.

After approval:

- Save **production credentials** in Settings (test mode turns off automatically).
- Register the **production webhook URLs** below in the partner portal.
- Set the **webhook signing secret** (or use platform HMAC with API secret).

Your own **online shop** (`order_source: online_shop`) is unchanged and does not require partner approval.

---

## Step-by-step: Just Eat (Takeaway.com / Flyt Partner API)

### 1. Register & get approved

1. Create a developer account: [Just Eat Takeaway.com Partner API](https://developers.just-eat.com/)
2. Apply for **Partner API** access for your restaurant brand / store(s).
3. Complete restaurant onboarding with Just Eat (menu, opening hours, go-live date).
4. When approved, note your **Store / restaurant ID**, **API key**, and **API secret**.

### 2. Configure Chaslay

**Settings → Delivery platforms → Just Eat**

| Field | What to enter |
|-------|----------------|
| Enable integration | On |
| Store / restaurant ID | Partner portal store ID |
| API key | Production API key |
| API secret | Production API secret |
| Webhook secret | Shared secret for signature verification (from JE webhook setup, or choose your own) |
| Auto-accept orders | Optional — skip manual approval in Chaslay |
| Test mode | Off automatically when API key + secret are saved |

### 3. Register webhook URL

Copy from Settings (replace `{MERCHANT_UUID}` with your merchant id):

```
https://api.chaslay.com/api/webhooks/just-eat/{MERCHANT_UUID}
```

In the Just Eat / Flyt partner portal, subscribe to **new order** events (e.g. order created / order placed — exact name depends on your JE contract).

**Headers Chaslay accepts**

- `X-Webhook-Secret: <your webhook secret>` **or**
- HMAC signature headers: `X-Flyt-Signature`, `X-JET-Signature`, `X-Signature` (SHA-256 HMAC of raw body)

### 4. Menu mapping

Map partner item SKUs / PLUs to **Products → SKU** in Chaslay. Unmapped items still appear on tickets by name.

---

## Step-by-step: Uber Eats (Eats API)

### 1. Register & get approved

1. Sign in to [Uber Developer Dashboard](https://developer.uber.com/)
2. Create an **Eats API** application (restaurant integration).
3. Request **production** access — Uber reviews your use case and links your store(s).
4. In **Uber Eats Manager**, authorize the app for your location(s).
5. Note **Client ID**, **Client secret**, and **Store ID**.

### 2. Configure Chaslay

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
https://api.chaslay.com/api/webhooks/uber-eats/{MERCHANT_UUID}
```

Subscribe to **`orders.notification`** (and related order release events per your Uber contract).

**Signature:** Uber sends `X-Uber-Signature: sha256=<hex>` — HMAC-SHA256 of the raw body using your webhook secret (falls back to client secret).

**Notification-only payloads:** Chaslay fetches full order details via `GET /v1/eats/orders/{id}` when OAuth credentials are configured.

### 4. Accept flow

When staff tap **Accept** on a Just Eat / Uber Eats order in Chaslay:

- **Uber:** `POST /v1/eats/orders/{id}/accept_pos_order`
- **Just Eat:** Flyt accept endpoint (store-scoped when `storeId` is set)

Failures are logged; the order still moves forward in Chaslay.

---

## Webhook URL format (all merchants)

| Platform | URL |
|----------|-----|
| Just Eat | `https://api.chaslay.com/api/webhooks/just-eat/{MERCHANT_UUID}` |
| Uber Eats | `https://api.chaslay.com/api/webhooks/uber-eats/{MERCHANT_UUID}` |
| Test (sandbox) | `https://api.chaslay.com/api/webhooks/delivery-platforms/just-eat\|uber-eats/{MERCHANT_UUID}/test` |

`{MERCHANT_UUID}` is shown on the Delivery platforms settings tab (same as `merchants.id`).

---

## Test locally

```bash
# 1. Run SQL migration
psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql

# 2. Enable platform in Settings (test mode ON, enabled ON)

# 3. Send test webhook
curl -X POST "http://localhost:3000/api/webhooks/delivery-platforms/just-eat/<MERCHANT_UUID>/test" \
  -H "Content-Type: application/json" \
  -d '{"externalOrderId":"TEST-001","items":[{"name":"Fries","quantity":1,"unitPrice":6.5}],"total":6.5}'
```

Order appears in **Orders** and **WebPOS** online panel. With Print Agent on the main till, kitchen/receipt jobs print within ~2.5s.

---

## Architecture

```
Partner webhook → map payload (JE / Uber) → DeliveryPlatformService.ingestOrder()
  → orders (orderType=web_shop, orderSource=justeat|ubereats)
  → chaslay_floor_print_jobs (kind=auto_print_order)
  → WebPOS poll → external-order-auto-print.ts → Print Agent

Accept in UI → OrderService.applyOrderAction('accept')
  → DeliveryPlatformService.notifyPartnerOrderAccepted() → partner API
```

Online shop orders continue via `POST /api/shop/...` with `order_source: online_shop` — no webhook required.

---

## Reservations (related POS alerts)

New or confirmed reservations enqueue `auto_print_reservation` print jobs and WebPOS polls `/merchant/reservations` every 8s for a **10-second** sound + banner alert.

---

## Files

- `backend/sql/ensure-delivery-platforms.sql`
- `backend/src/lib/delivery-platform-settings.ts`
- `backend/src/lib/delivery-platform-webhook-mappers.ts`
- `backend/src/services/delivery-platform.service.ts`
- `backend/src/routes/delivery-platform.routes.ts`
- `backend/src/services/reservation.service.ts` (reservation POS alerts)
- `dashboard/src/pages/merchant/settings/SettingsDeliveryPlatformsTab.tsx`
- `dashboard/src/lib/external-order-auto-print.ts`
- `dashboard/src/lib/webpos-print-relay.ts`
- `dashboard/src/pages/merchant/WebPos.tsx`

---

## Remaining hardening (optional)

- Encrypt `delivery_platform_settings` at rest
- Rate limiting on webhook routes
- Dead-letter queue for failed ingests
- Full menu sync / 86 (out of stock) APIs
- Channel badges in Orders UI
