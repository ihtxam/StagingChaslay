/** Safe SMS template interpolation. No HTML. Unknown tokens stay empty. */

export const SMS_TEMPLATE_VARS = [
  "firstName",
  "orderNumber",
  "pickupTime",
  "code",
  "shopName",
  "reservationCode",
  "when",
  "partySize",
] as const;

export type SmsTemplateVar = (typeof SMS_TEMPLATE_VARS)[number];
export type SmsTemplateVars = Partial<Record<SmsTemplateVar, string | number | null | undefined>>;

const TOKEN_RE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
const MAX_SMS_BODY = 612;

export function sanitizeSmsTemplate(raw: string | null | undefined): string {
  return String(raw || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SMS_BODY);
}

function sanitizeSmsValue(raw: string): string {
  return String(raw || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_SMS_BODY);
}

export function renderSmsTemplate(template: string, vars: SmsTemplateVars = {}): string {
  const safe = sanitizeSmsTemplate(template);
  const allowed = new Set<string>(SMS_TEMPLATE_VARS);
  const rendered = safe.replace(TOKEN_RE, (_full, key: string) => {
    if (!allowed.has(key)) return "";
    const value = vars[key as SmsTemplateVar];
    if (value == null) return "";
    return sanitizeSmsValue(String(value));
  });
  return rendered.replace(/[ \t]{2,}/g, " ").trim().slice(0, MAX_SMS_BODY);
}

export function gsmSegmentCount(body: string): number {
  const text = String(body || "");
  const gsmExtended = /[\^{}\\\[\]~|€]/g;
  let units = text.length;
  const extra = text.match(gsmExtended);
  if (extra) units += extra.length;
  if (units <= 160) return 1;
  if (units <= 306) return 2;
  if (units <= 460) return 3;
  return 4;
}

export type SmsEventKey =
  | "orderPlaced"
  | "orderReady"
  | "orderOutForDelivery"
  | "reservationNew"
  | "reservationConfirmed"
  | "reservationReminder"
  | "reservationCancelled"
  | "giftCardEcard";

export type SmsTemplateKey = SmsEventKey | "otpLogin" | "otpSignup" | "marketingFooter";

export const DEFAULT_SMS_TEMPLATES: Record<SmsTemplateKey, string> = {
  orderPlaced: "{shopName}: order {orderNumber} received. We will notify you when it is ready.",
  orderReady: "{shopName}: order {orderNumber} is ready to collect{pickupTime}.",
  orderOutForDelivery: "{shopName}: order {orderNumber} is on its way.",
  reservationNew:
    "{shopName}: we received your reservation {reservationCode} for {when} ({partySize} guests).",
  reservationConfirmed: "{shopName}: reservation {reservationCode} confirmed for {when}.",
  reservationReminder: "{shopName}: reminder — reservation {reservationCode} at {when}.",
  reservationCancelled: "{shopName}: reservation {reservationCode} was cancelled.",
  giftCardEcard: "{shopName}: your e-gift card code is {code}.",
  otpLogin: "{shopName}: your login code is {code}. It expires in 10 minutes.",
  otpSignup: "{shopName}: your verification code is {code}. It expires in 10 minutes.",
  marketingFooter: "Reply STOP to unsubscribe.",
};

export const DEFAULT_SMS_EVENTS: Record<SmsEventKey, boolean> = {
  orderPlaced: true,
  orderReady: true,
  orderOutForDelivery: true,
  reservationNew: true,
  reservationConfirmed: true,
  reservationReminder: true,
  reservationCancelled: true,
  giftCardEcard: true,
};

export type SmsSettings = {
  senderName: string | null;
  defaultCountry: string;
  events: Record<SmsEventKey, boolean>;
  templates: Record<SmsTemplateKey, string>;
};

export function normalizeSmsSettings(raw: unknown): SmsSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const eventsSrc =
    src.events && typeof src.events === "object" ? (src.events as Record<string, unknown>) : {};
  const templatesSrc =
    src.templates && typeof src.templates === "object"
      ? (src.templates as Record<string, unknown>)
      : {};
  const events = { ...DEFAULT_SMS_EVENTS };
  for (const key of Object.keys(DEFAULT_SMS_EVENTS) as SmsEventKey[]) {
    if (eventsSrc[key] === false) events[key] = false;
    if (eventsSrc[key] === true) events[key] = true;
  }
  const templates = { ...DEFAULT_SMS_TEMPLATES };
  for (const key of Object.keys(DEFAULT_SMS_TEMPLATES) as SmsTemplateKey[]) {
    if (typeof templatesSrc[key] === "string") {
      templates[key] = sanitizeSmsTemplate(templatesSrc[key] as string) || DEFAULT_SMS_TEMPLATES[key];
    }
  }
  const sender = String(src.senderName || "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, 11);
  const country = String(src.defaultCountry || "CH")
    .trim()
    .toUpperCase()
    .slice(0, 2) || "CH";
  return {
    senderName: sender || null,
    defaultCountry: country,
    events,
    templates,
  };
}

export function eventEnabled(settings: SmsSettings, event: SmsEventKey): boolean {
  return settings.events[event] !== false;
}
