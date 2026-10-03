# Phone → POS customer popup (proposal)

When a customer calls the restaurant, staff should see a **large POS modal** with profile, addresses, order history, lifetime spend, loyalty points, and **one-click reorder** — without implementing telephony in this document.

## Goals

- Reduce hold time and order errors by surfacing CRM context at ring time.
- Work for Swiss/EU merchants (GDPR, local PBX, mobile-first staff).
- Integrate with existing Reborn customer records, orders, and WebPOS cart APIs.

---

## 1. Hardware & telephony options

| Option | Fit | Caller ID | Notes |
|--------|-----|-----------|-------|
| **Cloud CPaaS (Twilio Voice, Vonage, MessageBird)** | High for multi-tenant SaaS | E.164 from SIP/PSTN | Webhooks on `ringing`/`answered`; Swiss numbers via regulated carriers; per-minute cost. |
| **Adyen / payment-adjacent voice** | Medium | If offered in region | Only if bundled with merchant comms; verify CH/EU coverage. |
| **On-prem PBX (Asterisk, FreePBX, 3CX)** | High for single-site restaurants | AMI/ARI events | Merchant owns PBX; Reborn agent or SIP trunk forwards events to our API. |
| **Hosted PBX (Swisscom, Sunrise, Infomaniak, etc.)** | High in CH | SIP headers, CRM APIs vary | Often need per-PBX integration or generic SIP REC. |
| **GSM gateway (GoIP, Yeastar)** | Medium for small sites | CLI from SIM | Good fallback when landline forwards to GSM; less reliable CLI. |
| **Android tablet as softphone (Zoiper, Linphone)** | MVP / pilot | App-dependent | Cheap; use foreground app + deep link to POS; harder at scale. |
| **Desk SIP phones (Yealink, Fanvil)** | Accessory | Display CLI only | Phone does not open POS — needs CTI bridge on LAN or cloud. |

**Recommendation:** Multi-tenant default = **Twilio (or EU CPaaS) + optional Asterisk AMI** for merchants who refuse cloud voice. Store **normalized E.164** on customers and index for lookup.

---

## 2. Software architecture

```
[PSTN/SIP] → [PBX or CPaaS] → webhook POST /v1/telephony/incoming
                                      │
                    match phone → Customer + Orders (backend)
                                      │
                    WebSocket / SSE → merchant POS sessions (location-scoped)
                                      │
                    WebPOS → IncomingCallCustomerModal (large overlay)
```

### CTI event flow

1. **Inbound signal** — `merchantId`, `locationId`, `callerE164`, `callId`, `direction`, optional `queue`.
2. **Customer resolve** — query `customers` by phone (last 9 digits fallback for CH); merge guest checkout phones.
3. **Enrich** — last N orders, `lifetimeSpend`, loyalty balance, default address, tags/allergies if stored.
4. **Push to clients** — authenticated channel keyed by `locationId` + staff session; debounce duplicate rings.
5. **POS UI** — modal with tabs; **Reorder** calls existing “repeat order” / cart rebuild endpoint.
6. **Dismiss** — on hang-up webhook or manual close; audit log without recording call audio by default.

### Privacy / GDPR

- **Lawful basis:** legitimate interest + merchant as controller; DPIA for automatic profiling at ring.
- **Data minimization:** show only fields needed for order-taking; mask full card data.
- **Retention:** CTI event logs 30–90 days; no call recording unless merchant opts in (separate product).
- **Swiss/EU:** EU-hosted webhook processing; DPA with Twilio; merchant setting to disable auto-popup.

---

## 3. Build vs buy

| Capability | Buy / integrate | Build in Reborn |
|------------|----------------|-----------------|
| PSTN/SIP termination | Twilio, Vonage, carrier SIP | — |
| PBX events | Asterisk AMI, 3CX API | Thin normalizer → internal event schema |
| Caller ID → customer | — | Phone index, fuzzy match, merge duplicates |
| Real-time to POS | — | Existing WS/SSE infra (or extend notifications) |
| Modal UI + reorder | — | WebPOS modal + cart APIs |
| Merchant settings | — | Enable CTI, map DIDs → location, test number |
| Android/desktop | Optional deep link | Later: Tauri/bridge hook for softphone |

**MVP should not build a PBX.** Build **event ingestion, customer match, POS modal, and reorder**.

---

## 4. Phased roadmap

### Phase 1 — Manual lookup (4–6 weeks engineering)

- WebPOS: **“Find by phone”** field → same modal content as auto-popup.
- Backend: `GET /merchant/customers/by-phone?e164=…` with order summary payload.
- No telephony; validates UX and reorder path.

### Phase 2 — Auto popup (6–10 weeks)

- Merchant telephony settings (DID list, provider type).
- Webhook adapter (Twilio first): ringing → push event.
- WebSocket subscription in WebPOS; modal auto-open with ring sound (optional).
- Staff can disable per shift.

### Phase 3 — Reorder + ops (4–6 weeks)

- One-click reorder with modifier diff preview.
- Link call to order note (`metadata.inboundCallId`).
- Order Center notification for missed calls (optional voicemail integration).

---

## 5. Codebase touchpoints (estimate)

| Area | Work |
|------|------|
| **Backend** | Phone normalization util; customer lookup by phone; aggregated “caller context” DTO; telephony webhook route + HMAC; WS event type `incoming_call`. |
| **WebPOS** | `IncomingCallCustomerModal`; subscribe to location events; reorder action wiring to cart store. |
| **Merchant settings** | Telephony section under Integrations; DID mapping per location. |
| **Notifications** | Optional bell entry when popup dismissed unread. |
| **Dashboard customers** | Show “last called” if CTI enabled (low priority). |

**Not in scope for MVP:** call recording, IVR builder, outbound dialer, WhatsApp Business calling.

---

## Open questions

1. Per-merchant Twilio subaccount vs platform-shared trunk with merchant DIDs?
2. Support multiple simultaneous POS stations — broadcast ring or “first to answer” claims customer?
3. Retail vs restaurant — same modal or simplified for barcode-heavy flow?
