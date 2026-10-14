export type ReservationSmsKind =
  | "waitlist"
  | "table_ready"
  | "confirmed"
  | "reminder"
  | "cancelled";

export type ReservationSmsLocale = "en" | "fr" | "de";

export function reservationSmsLocale(raw?: string | null): ReservationSmsLocale {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("de")) return "de";
  return "en";
}

export function buildReservationSms(opts: {
  kind: ReservationSmsKind;
  locale?: string | null;
  shopName: string;
  guestName: string;
  when: string;
  partySize: number;
  quotedWaitMinutes?: number | null;
  phone?: string | null;
}): { body: string; locale: ReservationSmsLocale } {
  const locale = reservationSmsLocale(opts.locale);
  const shop = opts.shopName || "Restaurant";
  const wait = opts.quotedWaitMinutes ? String(opts.quotedWaitMinutes) : null;
  const when = opts.when;
  const party = String(opts.partySize);
  const call = opts.phone ? ` ${opts.phone}` : "";

  const copy: Record<ReservationSmsKind, Record<ReservationSmsLocale, string>> = {
    waitlist: {
      en: wait
        ? `${shop}: you're on the waitlist for ${party} on ${when}. Quoted wait ~${wait} min. We'll text when a table opens.`
        : `${shop}: you're on the waitlist for ${party} on ${when}. We'll text when a table opens.`,
      fr: wait
        ? `${shop} : vous êtes sur liste d'attente (${party} pers.) le ${when}. Attente estimée ~${wait} min. SMS dès qu'une table se libère.`
        : `${shop} : vous êtes sur liste d'attente (${party} pers.) le ${when}. SMS dès qu'une table se libère.`,
      de: wait
        ? `${shop}: Sie stehen auf der Warteliste (${party} Pers.) am ${when}. Wartezeit ca. ${wait} Min. Wir SMS-en, wenn ein Tisch frei wird.`
        : `${shop}: Sie stehen auf der Warteliste (${party} Pers.) am ${when}. Wir SMS-en, wenn ein Tisch frei wird.`,
    },
    table_ready: {
      en: `${shop}: your table is ready. Please arrive within 10 minutes (${party} guests, ${when}).${call}`,
      fr: `${shop} : votre table est prête. Merci d'arriver dans les 10 minutes (${party} pers., ${when}).${call}`,
      de: `${shop}: Ihr Tisch ist bereit. Bitte kommen Sie innerhalb von 10 Minuten (${party} Pers., ${when}).${call}`,
    },
    confirmed: {
      en: `${shop}: table confirmed for ${party} on ${when}. See you soon.`,
      fr: `${shop} : table confirmée pour ${party} pers. le ${when}. À bientôt.`,
      de: `${shop}: Tisch bestätigt für ${party} Pers. am ${when}. Bis bald.`,
    },
    reminder: {
      en: `${shop}: reminder — we expect you today (${party} guests, ${when}).`,
      fr: `${shop} : rappel — nous vous attendons aujourd'hui (${party} pers., ${when}).`,
      de: `${shop}: Erinnerung — wir erwarten Sie heute (${party} Pers., ${when}).`,
    },
    cancelled: {
      en: `${shop}: your reservation for ${when} was cancelled. Call us if this is a mistake.${call}`,
      fr: `${shop} : votre réservation du ${when} a été annulée. Appelez-nous en cas d'erreur.${call}`,
      de: `${shop}: Ihre Reservierung am ${when} wurde storniert. Rufen Sie uns bei einem Irrtum an.${call}`,
    },
  };

  return { body: copy[opts.kind][locale], locale };
}

export function smsWebhookUrl(): string | null {
  const u = String(process.env.SMS_WEBHOOK_URL || process.env.ESENDEX_WEBHOOK_URL || "").trim();
  return u.startsWith("http") ? u : null;
}
