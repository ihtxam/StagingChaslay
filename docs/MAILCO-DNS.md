# Mailco / Postal DNS checklist

Platform email uses **mailco** (Postal at `postal.mailco.ch`, API at [ees.mailco.ch](https://ees.mailco.ch)). Merchant invites may still use **Brevo** when configured.

**Important:** SPF authorizes **mail server** IPs (Postal relay), not the Reborn app server (`91.98.41.165`). Default Postal relay: **`91.98.126.226`** / **`2a01:4f8:1c1a:82d4::1`** (`postal.mailco.ch`).

The Superadmin UI shows a live checklist: **Settings → Platform email → Mailco DNS checklist** (driven by `backend/src/lib/mailco-dns-guide.ts`).

Env overrides (optional): `MAILCO_POSTAL_IP`, `MAILCO_POSTAL_IPV6`, `MAILCO_POSTAL_SPF_INCLUDE`, `MAILCO_RETURN_PATH_HOST`, `MAILCO_DKIM_SELECTOR` (default `postal`), `MAILCO_DKIM_TARGET` (default `postal._domainkey.mailco.ch`). See `.env.production.example`.

This repo does **not** apply Cloudflare or Postal DNS. Publish the records below in Cloudflare (or copy values from ees.mailco.ch).

**From display name:** platform receipts must show **RebornPOS**, not the mailbox local-part of `hello@rebornsense.com` (inboxes otherwise display “hello”). Superadmin → Settings → mailco **From name** defaults to RebornPOS; empty / `hello` / legacy `Reborn` are sent as RebornPOS. Keep the address `hello@rebornsense.com` unless Mailco policy requires another verified sender.

---

## Where to edit DNS

| Zone | Who hosts it | What to add |
|------|----------------|-------------|
| `mailco.ch` | Cloudflare (Mailco) | SPF TXT on `spf.postal` and `rp.postal` — **this is the Gmail SPF NONE fix** |
| `rebornsense.com` (apex) | Cloudflare | Apex SPF include, DKIM CNAME, DMARC, `psrp` CNAME |
| `psrp.rebornsense.com` | CNAME → `rp.postal.mailco.ch` | **Do not add TXT here** (CNAME cannot coexist with SPF) |

Postal’s recommended pattern (`include:spf.postal.example.com` on the return-path) is used on the **apex**. The include host and `rp.postal.mailco.ch` use **explicit ip4/ip6** because:

- `include:spf.postalserver.io` has no public TXT for this install
- `A`/`AAAA` on `rp.postal.mailco.ch` are Cloudflare proxies (`104.21…` / `2606:4700…`), not the relay
- Receipt mail is sent from **IPv6** `2a01:4f8:1c1a:82d4::1` — an IPv4-only SPF would still fail

---

## 0. Mailco infra (fixes Gmail SPF NONE) — **not yet live**

Re-checked 12 Oct 2026: `TXT rp.postal.mailco.ch` and `TXT spf.postal.mailco.ch` are still empty. Envelope `m9cdwo@psrp.rebornsense.com` CNAMEs to `rp.postal.mailco.ch`, so Gmail / mail-tester report **SPF NONE**. This repo cannot publish Cloudflare or Postal DNS.

Publish in the **`mailco.ch` Cloudflare zone**:

| Type | Host | FQDN | Value |
|------|------|------|--------|
| TXT | `spf.postal` | `spf.postal.mailco.ch` | `v=spf1 ip4:91.98.126.226 ip6:2a01:4f8:1c1a:82d4::1 ~all` |
| TXT | `rp.postal` | `rp.postal.mailco.ch` | `v=spf1 ip4:91.98.126.226 ip6:2a01:4f8:1c1a:82d4::1 ~all` |

These two records fix every merchant/platform envelope that CNAMEs `psrp.*` → `rp.postal.mailco.ch`.

After publish, wait for DNS TTL (see [Verification](#verification-commands)) before Gmail shows SPF PASS.

---

## 1. Apex `rebornsense.com` (branded From, e.g. `hello@rebornsense.com`)

Add or merge at **Cloudflare** (one SPF TXT per host):

| Type | Host | Value |
|------|------|--------|
| TXT | `@` | `v=spf1 include:spf.postal.mailco.ch ~all` |
| CNAME | `postal._domainkey` | `postal._domainkey.mailco.ch` |
| CNAME | `psrp` | `rp.postal.mailco.ch` |
| TXT | `@` | *(unique verification string from ees.mailco.ch → Domains → Verify DNS)* |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@rebornsense.com` |

- Merge SPF if you already have `include:spf.brevo.com` or similar: e.g. `v=spf1 include:spf.postal.mailco.ch include:spf.brevo.com ~all`.
- **DMARC:** start with `p=none` (monitor). After stable SPF+DKIM pass, consider `p=quarantine` then `p=reject`.
- Copy the **exact** DKIM selector/target from ees.mailco.ch if they differ from `postal` / `postal._domainkey.mailco.ch` (live selector on receipts has been `postal-Gnwr5L`).
- Apex SPF include only works after `spf.postal.mailco.ch` exists (section 0). Gmail still evaluates the **envelope** (`psrp`), not this apex record.

---

## 2. Return-path `psrp.rebornsense.com` (and other `psrp.*` we emit)

Postal `custom_return_path_prefix` is `psrp`. Live setup (12 Oct 2026):

```
psrp.rebornsense.com.  CNAME  rp.postal.mailco.ch.
```

Keep that CNAME. **Do not** add `TXT` on `psrp.rebornsense.com` while the CNAME exists.

### mail-tester.com advice is wrong here

mail-tester may say:

> You do not have a SPF record, please add the following one to your domain `psrp.rebornsense.com`:
> `v=spf1 a mx ip4:91.98.126.226 ~all`

That is **incorrect** while `psrp.rebornsense.com` is a CNAME. A CNAME name cannot also have a TXT/SPF record (`dig +short TXT psrp.rebornsense.com` only shows `rp.postal.mailco.ch.`). Publish the two TXT records in the **`mailco.ch`** zone (section 0). Do not replace the CNAME with that IPv4-only `a mx` SPF — receipts leave Postal on **IPv6** `2a01:4f8:1c1a:82d4::1`.

If a merchant cannot CNAME (rare), publish this TXT **instead of** the CNAME:

| Type | Host | Value |
|------|------|--------|
| TXT | `psrp` | `v=spf1 ip4:91.98.126.226 ip6:2a01:4f8:1c1a:82d4::1 ~all` |

**Deliverability:** prefer platform From `hello@rebornsense.com` / `noreply@rebornsense.com` (apex). The envelope will still be `*@psrp.rebornsense.com` until Postal changes return-path.

---

## Verification commands

After publishing records, wait **at least 30 minutes** (Cloudflare SOA minimum TTL is 1800s for NODATA on `rp.postal`; the `psrp` CNAME TTL is ~300s). Gmail may cache SPF NONE longer.

```bash
# Mailco infra (must be non-empty TXT)
dig +short TXT spf.postal.mailco.ch
dig +short TXT rp.postal.mailco.ch

# Envelope host follows CNAME — SPF is on the target, not here
dig +short CNAME psrp.rebornsense.com
dig +short TXT psrp.rebornsense.com

# Apex SPF / DMARC / DKIM
dig +short TXT rebornsense.com
dig +short TXT _dmarc.rebornsense.com
dig +short CNAME postal._domainkey.rebornsense.com
```

Expected after publish:

```
spf.postal.mailco.ch.  TXT  "v=spf1 ip4:91.98.126.226 ip6:2a01:4f8:1c1a:82d4::1 ~all"
rp.postal.mailco.ch.   TXT  "v=spf1 ip4:91.98.126.226 ip6:2a01:4f8:1c1a:82d4::1 ~all"
psrp.rebornsense.com.  CNAME rp.postal.mailco.ch.
```

Re-test deliverability: [mail-tester.com](https://www.mail-tester.com) or Superadmin **Send production-routing test**. A new receipt to Gmail should show `spf=pass` on `psrp.rebornsense.com` (via `rp.postal.mailco.ch`).

---

## Brevo (fallback)

Brevo is configured via `BREVO_*` in production env. Apex may already include Brevo verification/DMARC report addresses; that does not replace Postal SPF on `rp.postal.mailco.ch` when mail is sent through Postal.
