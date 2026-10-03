# Accounting integrations (Bexio & Odoo)

Paid add-ons that let merchants export **daily, monthly, or yearly** sales and tax data for their accountant or push summaries into **Bexio** (Switzerland) or **Odoo**.

## Product scope

| Capability | Status |
|------------|--------|
| Period export (day / month / year / custom) | CSV + XLSX journal sheets |
| VAT breakdown by rate | From POS EOD `vatRows` |
| Payment method split (cash, card, terminal, …) | From EOD `paymentRows` |
| Chart-of-accounts mapping | Merchant settings (Kontonummer / Odoo codes) |
| Bexio API sync | Multi-line `manual_compound_entry` + idempotency |
| Bexio OAuth | Connect button + PAT fallback |
| Odoo API sync | JSON-2 `account.move` create |
| Agency / superadmin toggles | `bexioAddonEnabled` / `odooAddonEnabled` on merchant limits |

## Data source

All figures come from the same pipeline as **Reports → Export** (`PosReportsService.getOverviewDashboard`). Presets: `today`, `yesterday`, `this_month`, `last_month`, `last_3_months`, `custom`.

## Bexio

1. **Authentication**
   - **OAuth 2** (recommended for hosted Chaslay): env `BEXIO_OAUTH_CLIENT_ID`, `BEXIO_OAUTH_CLIENT_SECRET`, optional `BEXIO_OAUTH_REDIRECT_URI` (default `{PUBLIC_API_URL}/api/oauth/bexio/callback`).
   - **Personal access token** still supported; PAT wins if both are set.

2. **API push**
   - Builds the same journal lines as CSV export.
   - Resolves Kontonummer → `account_id` via `GET /2.0/accounts`.
   - Posts `POST /2.0/accounting/manual_entries` with `type: manual_compound_entry`.
   - Idempotency: `lastPushedReference` = `CHASLAY-{merchant}-{from}_{to}`.

3. **Scopes** (OAuth app): `accounting`, `accounting_settings_show`, `openid profile email offline_access`.

## Odoo

1. **Authentication**: API key + optional `X-Odoo-Database`.
2. **API push**: resolves `account.journal` by code, `account.account` by code; creates one `account.move` (`move_type: entry`) per period with balanced lines.

## Merchant UX

1. Reseller / superadmin enables **Bexio** and/or **Odoo** on the merchant.
2. **Settings → Accounting**: map accounts, OAuth or PAT / Odoo key, test connection, push today / this month when API mode is on.
3. **Reports**: download Bexio/Odoo CSV or Excel workbook.

## Security

- Secrets and OAuth tokens live in `accounting_integration_settings` JSON (masked on read).
- OAuth callback is public; `state` is HMAC-signed with merchant id + expiry.

## Add-on keys

- `bexio` — Bexio export + API  
- `odoo` — Odoo export + API  
