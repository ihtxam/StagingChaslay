# Reservations without full online shop

Merchants can run **reservations only** with `reservationsEnabled: true` and `shopEnabled: false`.

## What works

- Public booking: `/shop/{slug}/reservations` (and location-scoped paths)
- Embed widget: `/embed/reborn-reservations.js` with `data-shop="{slug}"`
- Panel: Settings → Reservations (edition feature `reservations`)
- API: `GET/POST /api/shop/:slug/reservations/*` (requires `reservationsEnabled`, not `shopEnabled`)
- Custom domain TLS probe when reservations or CMS homepage is enabled

## What does not work without `shopEnabled`

- Online menu ordering and checkout (`requireShopOrdering` returns 403)
- Order Center (shop-only surface; gated by `shopEnabled`)
- Full shop menu as an ordering channel (menu browse may still load for photo-menu / widgets)

## Edge cases

- Turn on **Accepting reservations** in shop settings independently of **Enable online shop**
- Photo menu on reservation flows uses shop catalog APIs; products in deactivated categories are hidden via catalog visibility
