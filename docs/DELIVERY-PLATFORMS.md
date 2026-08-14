# Delivery platforms (Just Eat & Uber Eats)

Scaffold for aggregator order ingestion into Chaslay POS. Production API approval and full menu sync are **not** complete yet.

## What works today

| Area | Status |
|------|--------|
| Settings → **Delivery platforms** tab | Credentials, test mode, webhook URLs |
| DB | `merchants.delivery_platform_settings`, `orders.order_source`, `orders.external_order_id` |
| Webhooks | `POST /api/webhooks/just-eat/:merchantId`, `POST /api/webhooks/uber-eats/:merchantId` |
| Test ingest | `POST /api/webhooks/delivery-platforms/:platform/:merchantId/test` (test mode) |
| Order channel enum | `online_shop`, `justeat`, `ubereats` |
| POS / Orders board | Same `web_shop` kitchen lifecycle as own online shop |
| Auto-print | Backend enqueues `auto_print_order` print job → WebPOS main till drains via Print Agent |

## Migration

```bash
psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql
```

Hetzner deploy runs this automatically via `scripts/deploy-hetzner.sh`.

## Merchant setup

1. **Settings → Delivery platforms**
2. Enable Just Eat and/or Uber Eats
3. Keep **Test mode** on until partner APIs are approved
4. Set **Webhook secret** (sent as `X-Webhook-Secret` or HMAC `X-Signature`)
5. Copy webhook URL into the partner portal

## Webhook payload (normalized test format)

Both platforms are normalized to this shape (real partner payloads will need mappers):

```json
{
  "externalOrderId": "JE-12345",
  "fulfillmentChannel": "delivery",
  "customerName": "Alex Example",
  "customerPhone": "+41791234567",
  "shippingAddress": "Bahnhofstrasse 1, 8001 Zürich",
  "items": [
    { "sku": "BURGER-01", "name": "Classic Burger", "quantity": 2, "unitPrice": 14.5 }
  ],
  "total": 29.0,
  "notes": "Ring doorbell"
}
```

Headers (test mode accepts without secret; production requires one):

- `X-Webhook-Secret: <your secret>` **or**
- `X-Signature: sha256=<hmac hex of raw body>`

## Test locally

```bash
# 1. Run SQL migration
psql "$DATABASE_URL" -f backend/sql/ensure-delivery-platforms.sql

# 2. Enable platform in Settings (test mode + enabled)

# 3. Send test webhook
curl -X POST "http://localhost:3000/api/webhooks/delivery-platforms/just-eat/<MERCHANT_UUID>/test" \
  -H "Content-Type: application/json" \
  -d '{"externalOrderId":"TEST-001","items":[{"name":"Fries","quantity":1,"unitPrice":6.5}],"total":6.5}'
```

Order appears in **Orders** board and **WebPOS** online panel. With Print Agent on the main till and auto-print enabled in **Settings → Receipt**, kitchen/receipt jobs print within ~2.5s.

## Architecture

```
Partner webhook → DeliveryPlatformService.ingestOrder()
  → orders (orderType=web_shop, orderSource=justeat|ubereats)
  → chaslay_floor_print_jobs (kind=auto_print_order)
  → WebPOS poll → external-order-auto-print.ts → Print Agent
```

Polling fallback (TODO): cron service calling partner REST APIs when webhooks unavailable.

## Production TODO

### Just Eat (Takeaway.com Partner API)

- [ ] Partner account + restaurant onboarding approval
- [ ] OAuth / API credentials (replace test-mode-only flow)
- [ ] Register production webhook for `order.created` (exact event names per JE docs)
- [ ] HMAC verification per Just Eat spec (header name + signing string)
- [ ] Map JE menu item IDs ↔ POS `products.sku` or new `external_refs` JSON
- [ ] Order status callbacks (accept / reject / ready / picked up)
- [ ] Menu availability sync (86 items)

Docs: [Just Eat Takeaway.com Partner API](https://developers.just-eat.com/)

### Uber Eats

- [ ] Uber Eats Manager + Eats API application approval
- [ ] OAuth2 client credentials (`clientId` / `clientSecret` in settings)
- [ ] Webhook subscription for `orders.notification` / order release events
- [ ] Uber signature verification (`X-Uber-Signature`)
- [ ] Menu ingest API + item mapping
- [ ] Accept/deny/deny-out-of-stock + ready-for-pickup status API
- [ ] Polling fallback via `GET /v1/eats/stores/{store_id}/orders` if webhooks missed

Docs: [Uber Eats API](https://developer.uber.com/docs/eats)

### Platform hardening

- [ ] Encrypt `delivery_platform_settings` at rest (KMS or app-level AES)
- [ ] Rate limiting on webhook routes
- [ ] Dead-letter queue for failed ingests
- [ ] Android sync: expose `orderSource` in `/v1/orders/incoming`
- [ ] Orders UI: channel badge (Just Eat / Uber Eats / Online shop)
- [ ] Superadmin: platform-wide webhook debug log

## Files touched

- `backend/sql/ensure-delivery-platforms.sql`
- `backend/src/lib/delivery-platform-settings.ts`
- `backend/src/services/delivery-platform.service.ts`
- `backend/src/routes/delivery-platform.routes.ts`
- `backend/src/db/schema.ts`
- `backend/src/services/merchant-settings.service.ts`
- `backend/src/services/pos-orders.service.ts`
- `backend/src/routes/shop.routes.ts` (`orderSource: online_shop`)
- `dashboard/src/pages/merchant/settings/SettingsDeliveryPlatformsTab.tsx`
- `dashboard/src/pages/merchant/Settings.tsx`
- `dashboard/src/lib/external-order-auto-print.ts`
- `dashboard/src/lib/webpos-print-relay.ts`
- `dashboard/src/lib/order-management.ts`
- `scripts/deploy-hetzner.sh`
