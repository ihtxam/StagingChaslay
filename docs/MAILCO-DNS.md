# Mailco / Postal DNS checklist

Platform email uses **mailco** (Postal at `postal.mailco.ch`, API at [ees.mailco.ch](https://ees.mailco.ch)). Merchant invites may still use **Brevo** when configured.

**Important:** SPF authorizes **mail server** IPs (Postal relay), not the Reborn app server (`91.98.41.165`). Default Postal relay: **`91.98.126.226`** (`postal.mailco.ch`).

The Superadmin UI shows a live checklist: **Settings → Platform email → Mailco DNS checklist** (driven by `backend/src/lib/mailco-dns-guide.ts`).

## Where to edit DNS

| Zone | Who hosts it | UI |
|------|----------------|-----|
| `rebornsense.com` (apex) | Cloudflare (registrar DNS) | Cloudflare DNS or copy values from ees.mailco.ch |
| `psrp.rebornsense.com` | Mailco Postal (`NS` → `rp.postal.mailco.ch`) | Mailco Postal DNS for the `psrp` subdomain — **not** Cloudflare |

When `psrp` is NS-delegated, public lookups for `TXT psrp.rebornsense.com` only show `rp.postal.mailco.ch.` until you add records **inside Postal**.

Env overrides (optional): `MAILCO_POSTAL_IP`, `MAILCO_POSTAL_SPF_INCLUDE`, `MAILCO_DKIM_SELECTOR` (default `postal`), `MAILCO_DKIM_TARGET` (default `postal._domainkey.mailco.ch`). See `.env.production.example`.

---

## 1. Apex `rebornsense.com` (branded From, e.g. `noreply@rebornsense.com`)

Add or merge at **Cloudflare** (one SPF TXT per host):

| Type | Host | Value |
|------|------|--------|
| TXT | `@` | `v=spf1 include:spf.postal.mailco.ch ~all` |
| CNAME | `postal._domainkey` | `postal._domainkey.mailco.ch` |
| TXT | `@` | *(unique verification string from ees.mailco.ch → Domains → Verify DNS)* |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@rebornsense.com` |

- Merge SPF if you already have `include:spf.brevo.com` or similar: e.g. `v=spf1 include:spf.postal.mailco.ch include:spf.brevo.com ~all`.
- **DMARC:** start with `p=none` (monitor). After stable SPF+DKIM pass, consider `p=quarantine` then `p=reject`.
- Copy the **exact** DKIM selector/target from ees.mailco.ch if they differ from `postal` / `postal._domainkey.mailco.ch`.

Optional NS at apex (only if Mailco asks):

| Type | Host | Value |
|------|------|--------|
| NS | `psrp` | `rp.postal.mailco.ch` |

---

## 2. Postal return-path `psrp.rebornsense.com` (fixes SPF when From/envelope uses `*@psrp.rebornsense.com`)

In **Mailco Postal** DNS for `psrp.rebornsense.com` (zone `@` = the subdomain itself):

| Type | Host | Value |
|------|------|--------|
| TXT | `@` | `v=spf1 a mx ip4:91.98.126.226 ~all` |

Alternative (if Mailco documents the include for this zone): `v=spf1 include:spf.postal.mailco.ch ~all`.

Optional DMARC on the postal subdomain (only if you send with From `@psrp...` long-term):

| Type | Host | Value |
|------|------|--------|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@rebornsense.com` |

**Deliverability:** prefer platform From `noreply@rebornsense.com` (apex) once apex DNS is verified, not `m9cdwo@psrp.rebornsense.com`.

---

## Verification commands

After publishing records (wait 5–15 minutes, then):

```bash
# Apex SPF / DMARC / DKIM
dig +short TXT rebornsense.com
dig +short TXT _dmarc.rebornsense.com
dig +short CNAME postal._domainkey.rebornsense.com

# Postal subdomain (delegated — may only resolve after Postal TXT exists)
dig +short NS psrp.rebornsense.com
dig +short TXT psrp.rebornsense.com
dig +short TXT _dmarc.psrp.rebornsense.com
```

Re-test deliverability: [mail-tester.com](https://www.mail-tester.com) or Superadmin **Send production-routing test**.

---

## Brevo (fallback)

Brevo is configured via `BREVO_*` in production env. Apex may already include Brevo verification/DMARC report addresses; that does not replace Postal SPF on `psrp.rebornsense.com` when mail is sent through Postal.
