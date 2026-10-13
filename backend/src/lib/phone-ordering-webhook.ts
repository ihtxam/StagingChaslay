/** Parse Twilio / generic SMS-voice payloads for phone ordering. */

export const PHONE_ORDER_SOURCE = "phone";

export function isPhoneOrderSource(value?: string | null): boolean {
  return String(value || "").trim().toLowerCase() === PHONE_ORDER_SOURCE;
}

export function phoneCreateAllowsEmptyItems(orderSource?: string | null, itemCount = 0): boolean {
  return itemCount > 0 || isPhoneOrderSource(orderSource);
}

export type PhoneInboundKind = "sms" | "voice" | "generic";

export type PhoneInboundPayload = {
  kind: PhoneInboundKind;
  from: string | null;
  to: string | null;
  body: string | null;
  customerName: string | null;
  externalId: string | null;
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s.slice(0, 500);
  }
  return null;
}

export function extractWebhookSecret(input: {
  headers?: Record<string, unknown> | null;
  query?: Record<string, unknown> | null;
  body?: Record<string, unknown> | null;
}): string | null {
  const headers = input.headers || {};
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  const auth = firstString(lower["authorization"]);
  const bearer = auth && /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : null;
  return firstString(
    lower["x-webhook-secret"],
    lower["x-phone-ordering-secret"],
    bearer,
    input.query?.secret,
    input.query?.token,
    input.body?.secret,
    input.body?.webhookSecret
  );
}

export function parsePhoneInbound(body: Record<string, unknown> | null | undefined): PhoneInboundPayload {
  const src = (body || {}) as Record<string, unknown>;
  const twilioSid = firstString(src.MessageSid, src.SmsSid, src.CallSid);
  const isVoice = !!(src.CallSid || src.CallStatus || src.Digits);
  const isSms = !!(src.MessageSid || src.SmsSid || src.Body);
  const kind: PhoneInboundKind = isVoice ? "voice" : isSms ? "sms" : "generic";
  return {
    kind,
    from: firstString(src.From, src.from, src.phone, src.caller, src.customerPhone),
    to: firstString(src.To, src.to),
    body: firstString(src.Body, src.body, src.message, src.SpeechResult, src.Digits, src.notes),
    customerName: firstString(src.CallerName, src.customerName, src.name),
    externalId: twilioSid || firstString(src.id, src.externalId, src.external_id),
  };
}

export function phoneTicketNotes(payload: PhoneInboundPayload): string {
  const parts = [
    payload.kind === "voice" ? "Inbound voice call" : payload.kind === "sms" ? "Inbound SMS" : "Phone inbound",
    payload.from ? `from ${payload.from}` : null,
    payload.to ? `to ${payload.to}` : null,
    payload.body,
  ].filter(Boolean);
  return parts.join(" — ").slice(0, 2000);
}
