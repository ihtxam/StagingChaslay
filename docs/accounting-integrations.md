# Accounting integrations (Bexio & Odoo)

Paid add-ons that let merchants (e.g. Amar Chand) export **daily, monthly, or yearly** sales and tax data for their accountant or push summaries into **Bexio** (Switzerland) or **Odoo**.

## Product scope

| Capability | Phase 1 (this release) | Phase 2 |
|------------|------------------------|---------|
| Period export (day / month / year / custom) | CSV + XLSX journal sheets | Same |
| VAT breakdown by rate | From POS EOD `vatRows` | Per-order detail optional |
| Payment method split (cash, card, terminal, …) | From EOD `paymentRows` | Adyen fee lines optional |
| Chart-of-accounts mapping | Merchant settings | Reseller templates |
| Bexio API sync (manual journal) | Optional PAT + “Push period” | OAuth app + idempotency |
| Odoo API sync (`account.move`) | Connection test + export | Full JSON-2 push |

## Data source

All figures come from the same pipeline as **Reports → Export** (`PosReportsService.getOverviewDashboard` / `ReportExportService`). That keeps POS, refunds, tips, and VAT aligned with EOD print.

Presets:

- `today`, `yesterday` — daily
- `this_month`, `last_month`, `last_3_months` — monthly / rolling
- `custom` — arbitrary range (yearly = custom `from` / `to`)

## Bexio best practices

References: [Bexio API docs](https://docs.bexio.com/), OpenID issuer `https://auth.bexio.com/realms/bexio`.

1. **Authentication**
   - **Personal Access Token (PAT)** for single-merchant setups (simplest).
   - **OAuth 2 authorization code** for multi-tenant apps; request minimal scopes:
     - `accounting` — manual journal entries
     - `accounting_settings_show` — read accounts / taxes for mapping UI
     - `openid profile email offline_access` — standard OIDC

2. **What to post**
   - **Retail / restaurant POS**: prefer **aggregated manual entries** (`POST /2.0/accounting/manual_entries`, type `manual_single_entry` or grouped) per business day or month—not one API call per receipt (rate limits and reconciliation noise).
   - Attach **reference** = `CHASLAY-{merchantId}-{from}-{to}` for idempotency; store `lastPushedReference` in merchant settings before calling API.

3. **Mapping**
   - Map Chaslay payment methods → Bexio **balance sheet / clearing accounts** (e.g. 1020 cash, 1090 card clearing).
   - Map net sales → **3xxx revenue** accounts; VAT → **2200 VAT payable** (or Bexio `tax_id` on lines).
   - Tips: separate revenue or liability account per merchant policy.

4. **Files**
   - Phase 1 CSV uses **account numbers** (Kontonummer) for manual import or accountant review.
   - Optional receipt PDF: upload to Bexio inbox (`file` scope) and link to manual entry (phase 2).

## Odoo best practices

References: [Odoo External JSON-2 API](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html) (successor to XML-RPC / JSON-RPC).

1. **Authentication**
   - **API key** on a dedicated integration user (replace password in scripts).
   - Header: `Authorization: bearer {api_key}`; optional `X-Odoo-Database` on multi-DB hosts.

2. **What to post**
   - **Summary journal** on `account.move` with `move_type=entry` in a dedicated journal (e.g. `POS`).
   - One move per export period; lines = payment debits, revenue + tax credits, refund reversals.
   - For invoice-level detail: `out_invoice` per B2B order only (not default for B2C POS).

3. **Mapping**
   - Resolve `account.account` by code via `search_read` once; cache IDs in merchant settings.
   - Taxes: use `account.tax` IDs matching Swiss VAT rates configured in Odoo.

4. **Plans**
   - External API requires Odoo **Custom** (or self-hosted) plans—not “One App Free” SaaS tiers.

## Merchant UX

1. Reseller enables **Bexio** and/or **Odoo** add-on on the merchant (Billing / superadmin limits).
2. **Settings → Accounting**: map accounts, optional API credentials, test connection.
3. **Reports**: export **Standard**, **Bexio journal CSV**, or **Odoo journal CSV** for the selected period.
4. Optional **Push to Bexio/Odoo** when API credentials are saved (manager permission).

## Security

- Secrets stored encrypted at rest in `accounting_integration_settings` JSON (same pattern as delivery platforms: masked on read, merge on write).
- Routes require `VIEW_REPORTS` or `MANAGE_SETTINGS` as appropriate.
- Push endpoints refuse when the corresponding add-on flag is off.

## Add-on keys

- `bexio` — Bexio export + API
- `odoo` — Odoo export + API

Seed catalog entries via `SubscriptionAddonsService.ensureMissingDefaultAddons`.
