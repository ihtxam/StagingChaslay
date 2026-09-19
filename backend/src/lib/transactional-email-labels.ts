/** Transactional email copy keyed by customer/shop locale. */

export type TxLocale = 'en' | 'fr' | 'de';

function loc(raw?: string | null): TxLocale {
  const l = String(raw || 'en').toLowerCase().slice(0, 2);
  if (l === 'fr' || l === 'de') return l;
  return 'en';
}

export function resolveTxLocale(opts?: {
  guestLocale?: string | null;
  shopLanguage?: string | null;
  panelLanguage?: string | null;
}): TxLocale {
  return loc(opts?.guestLocale || opts?.shopLanguage || opts?.panelLanguage || 'en');
}

type ReservationKind =
  | 'received'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'seated'
  | 'reminder';

const RESERVATION_SUBJECTS: Record<TxLocale, Record<ReservationKind, (shop: string) => string>> = {
  en: {
    received: (s) => `Reservation request received — ${s}`,
    confirmed: (s) => `Reservation confirmed — ${s}`,
    rejected: (s) => `Reservation not available — ${s}`,
    cancelled: (s) => `Reservation cancelled — ${s}`,
    seated: (s) => `Welcome — ${s}`,
    reminder: (s) => `Reminder: your reservation at ${s}`,
  },
  fr: {
    received: (s) => `Demande de réservation reçue — ${s}`,
    confirmed: (s) => `Réservation confirmée — ${s}`,
    rejected: (s) => `Réservation non disponible — ${s}`,
    cancelled: (s) => `Réservation annulée — ${s}`,
    seated: (s) => `Bienvenue — ${s}`,
    reminder: (s) => `Rappel : votre réservation chez ${s}`,
  },
  de: {
    received: (s) => `Reservierungsanfrage erhalten — ${s}`,
    confirmed: (s) => `Reservierung bestätigt — ${s}`,
    rejected: (s) => `Reservierung nicht verfügbar — ${s}`,
    cancelled: (s) => `Reservierung storniert — ${s}`,
    seated: (s) => `Willkommen — ${s}`,
    reminder: (s) => `Erinnerung: Ihre Reservierung bei ${s}`,
  },
};

const RESERVATION_BODIES: Record<TxLocale, Record<ReservationKind, string>> = {
  en: {
    received: 'We received your reservation request and will confirm shortly.',
    confirmed: 'Your table is confirmed. We look forward to seeing you!',
    rejected: 'Unfortunately we cannot accommodate this reservation. Please try another time.',
    cancelled: 'Your reservation has been cancelled.',
    seated: 'Welcome! Your table is ready.',
    reminder: 'This is a friendly reminder about your upcoming reservation.',
  },
  fr: {
    received: 'Nous avons bien reçu votre demande de réservation et la confirmerons sous peu.',
    confirmed: 'Votre table est confirmée. Nous avons hâte de vous accueillir !',
    rejected: 'Malheureusement nous ne pouvons pas honorer cette réservation. Merci de choisir un autre créneau.',
    cancelled: 'Votre réservation a été annulée.',
    seated: 'Bienvenue ! Votre table est prête.',
    reminder: 'Rappel amical concernant votre prochaine réservation.',
  },
  de: {
    received: 'Wir haben Ihre Reservierungsanfrage erhalten und bestätigen sie in Kürze.',
    confirmed: 'Ihr Tisch ist bestätigt. Wir freuen uns auf Ihren Besuch!',
    rejected: 'Leider können wir diese Reservierung nicht annehmen. Bitte wählen Sie eine andere Zeit.',
    cancelled: 'Ihre Reservierung wurde storniert.',
    seated: 'Willkommen! Ihr Tisch ist bereit.',
    reminder: 'Freundliche Erinnerung an Ihre bevorstehende Reservierung.',
  },
};

const RES_LABELS: Record<
  TxLocale,
  { code: string; when: string; guests: string; name: string; table: string; where: string; offer: string; questions: string }
> = {
  en: {
    code: 'Code',
    when: 'When',
    guests: 'Guests',
    name: 'Name',
    table: 'Table',
    where: 'Where',
    offer: 'Offer',
    questions: 'Questions? Call',
  },
  fr: {
    code: 'Code',
    when: 'Quand',
    guests: 'Convives',
    name: 'Nom',
    table: 'Table',
    where: 'Adresse',
    offer: 'Offre',
    questions: 'Des questions ? Appelez',
  },
  de: {
    code: 'Code',
    when: 'Wann',
    guests: 'Gäste',
    name: 'Name',
    table: 'Tisch',
    where: 'Adresse',
    offer: 'Angebot',
    questions: 'Fragen? Rufen Sie an',
  },
};

export function reservationEmailCopy(
  kind: ReservationKind,
  shop: string,
  locale?: string | null
): { subject: string; body: string; labels: (typeof RES_LABELS)['en'] } {
  const lang = loc(locale);
  return {
    subject: RESERVATION_SUBJECTS[lang][kind](shop),
    body: RESERVATION_BODIES[lang][kind],
    labels: RES_LABELS[lang],
  };
}

type ShopOrderKind = 'received' | 'confirmed' | 'ready' | 'out_for_delivery' | 'cancelled';

const SHOP_ORDER_SUBJECTS: Record<TxLocale, Record<ShopOrderKind, (shop: string, n: string) => string>> = {
  en: {
    received: (s, n) => `Order ${n} confirmed — ${s}`,
    confirmed: (s, n) => `Order #${n} accepted — ${s}`,
    ready: (s, n) => `Order ${n} is ready — ${s}`,
    out_for_delivery: (s, n) => `Order ${n} is on the way — ${s}`,
    cancelled: (s, n) => `Order ${n} cancelled — ${s}`,
  },
  fr: {
    received: (s, n) => `Commande ${n} confirmée — ${s}`,
    confirmed: (_s, n) => `Commande #${n} acceptée`,
    ready: (s, n) => `Commande ${n} prête — ${s}`,
    out_for_delivery: (s, n) => `Commande ${n} en livraison — ${s}`,
    cancelled: (s, n) => `Commande ${n} annulée — ${s}`,
  },
  de: {
    received: (s, n) => `Bestellung ${n} bestätigt — ${s}`,
    confirmed: (s, n) => `Bestellung #${n} angenommen — ${s}`,
    ready: (s, n) => `Bestellung ${n} ist bereit — ${s}`,
    out_for_delivery: (s, n) => `Bestellung ${n} ist unterwegs — ${s}`,
    cancelled: (s, n) => `Bestellung ${n} storniert — ${s}`,
  },
};

const SHOP_ORDER_BODIES: Record<TxLocale, Record<ShopOrderKind, string>> = {
  en: {
    received: 'We have received your order and are preparing it.',
    confirmed: 'We have received your order and the kitchen has started.',
    ready: 'Your order is ready for pickup.',
    out_for_delivery: 'Your driver is on the way.',
    cancelled: 'Your order has been cancelled.',
  },
  fr: {
    received: 'Nous avons bien reçu votre commande et nous la préparons.',
    confirmed: 'Nous avons bien reçu votre commande et la cuisine a commencé.',
    ready: 'Votre commande est prête à être récupérée.',
    out_for_delivery: 'Votre livreur est en route.',
    cancelled: 'Votre commande a été annulée.',
  },
  de: {
    received: 'Wir haben Ihre Bestellung erhalten und bereiten sie vor.',
    confirmed: 'Wir haben Ihre Bestellung erhalten und die Küche hat begonnen.',
    ready: 'Ihre Bestellung ist zur Abholung bereit.',
    out_for_delivery: 'Ihr Fahrer ist unterwegs.',
    cancelled: 'Ihre Bestellung wurde storniert.',
  },
};

export function shopOrderEmailCopy(
  kind: ShopOrderKind,
  shop: string,
  orderNumber: string,
  locale?: string | null
): { subject: string; body: string } {
  const lang = loc(locale);
  return {
    subject: SHOP_ORDER_SUBJECTS[lang][kind](shop, orderNumber),
    body: SHOP_ORDER_BODIES[lang][kind],
  };
}

const MERCHANT_NEW_ORDER: Record<TxLocale, { subject: (shop: string, n: string) => string; body: string }> = {
  en: {
    subject: (s, n) => `New online order ${n} — ${s}`,
    body: 'A new online order was placed. Open the orders screen to accept it.',
  },
  fr: {
    subject: (s, n) => `Nouvelle commande en ligne ${n} — ${s}`,
    body: 'Une nouvelle commande en ligne a été passée. Ouvrez les commandes pour l’accepter.',
  },
  de: {
    subject: (s, n) => `Neue Online-Bestellung ${n} — ${s}`,
    body: 'Eine neue Online-Bestellung ist eingegangen. Öffnen Sie die Bestellungen, um sie anzunehmen.',
  },
};

export function merchantNewOrderEmailCopy(
  shop: string,
  orderNumber: string,
  locale?: string | null
): { subject: string; body: string } {
  const lang = loc(locale);
  return {
    subject: MERCHANT_NEW_ORDER[lang].subject(shop, orderNumber),
    body: MERCHANT_NEW_ORDER[lang].body,
  };
}

export function shopOrderTrackLabel(locale?: string | null): string {
  const lang = loc(locale);
  if (lang === 'fr') return 'Suivre votre commande';
  if (lang === 'de') return 'Bestellung verfolgen';
  return 'Track your order';
}

export function shopOrderReadyLabel(locale?: string | null): string {
  const lang = loc(locale);
  if (lang === 'fr') return 'Prévu pour';
  if (lang === 'de') return 'Geplant für';
  return 'Scheduled for';
}

export type ShopOrderEmailLabels = {
  orderConfirmedBadge: string;
  orderStatusLabel: string;
  thankYou: (name: string) => string;
  orderType: string;
  payment: string;
  total: string;
  qty: string;
  item: string;
  unit: string;
  lineTotal: string;
  subtotal: string;
  discount: string;
  summary: string;
  pickupAt: string;
  deliverTo: string;
  scheduledFor: string;
  orderInstructions: string;
  needHelp: string;
  needHelpBody: string;
  call: string;
  email: string;
  autoMessage: string;
  statusAccepted: string;
  statusReady: string;
  statusOnTheWay: string;
  statusCancelled: string;
  headlineAccepted: string;
  headlineReady: string;
  headlineOnTheWay: string;
  headlineCancelled: string;
  etaMinutes: (minutes: number) => string;
  fulfillmentTakeaway: string;
  fulfillmentDelivery: string;
  fulfillmentDineIn: string;
  paymentCash: string;
  paymentCard: string;
  paymentPayLater: string;
  paymentOnline: string;
};

const SHOP_ORDER_LABELS: Record<TxLocale, ShopOrderEmailLabels> = {
  en: {
    orderConfirmedBadge: 'ORDER CONFIRMED',
    orderStatusLabel: 'ORDER STATUS',
    thankYou: (name) => `Thank you, ${name}!`,
    orderType: 'Order type',
    payment: 'Payment',
    total: 'Total',
    qty: 'Qty',
    item: 'Item',
    unit: 'Unit',
    lineTotal: 'Subtotal',
    subtotal: 'Subtotal',
    discount: 'Discount',
    summary: 'Summary',
    pickupAt: 'Pick up at',
    deliverTo: 'Deliver to',
    scheduledFor: 'Scheduled for',
    orderInstructions: 'Order instructions',
    needHelp: 'Need help?',
    needHelpBody: 'For any questions about your order, contact us — we are here to help.',
    call: 'Call',
    email: 'Email',
    autoMessage: 'This is an automated message — please do not reply directly to this email.',
    statusAccepted: 'Accepted',
    statusReady: 'Ready',
    statusOnTheWay: 'On the way',
    statusCancelled: 'Cancelled',
    headlineAccepted: 'Your order is on its way to the kitchen',
    headlineReady: 'Your order is ready',
    headlineOnTheWay: 'Your order is on the way',
    headlineCancelled: 'Your order was cancelled',
    etaMinutes: (m) => `Estimated ~${m} min.`,
    fulfillmentTakeaway: 'Takeaway',
    fulfillmentDelivery: 'Delivery',
    fulfillmentDineIn: 'Dine in',
    paymentCash: 'Cash',
    paymentCard: 'Card',
    paymentPayLater: 'Pay on pickup',
    paymentOnline: 'Online',
  },
  fr: {
    orderConfirmedBadge: 'COMMANDE CONFIRMÉE',
    orderStatusLabel: 'STATUT DE LA COMMANDE',
    thankYou: (name) => `Merci, ${name} !`,
    orderType: 'Type de commande',
    payment: 'Paiement',
    total: 'Total',
    qty: 'Qté',
    item: 'Article',
    unit: 'Unité',
    lineTotal: 'Sous-total',
    subtotal: 'Sous-total',
    discount: 'Remise',
    summary: 'Récapitulatif',
    pickupAt: 'À retirer chez',
    deliverTo: 'Livraison chez',
    scheduledFor: 'Prévu pour',
    orderInstructions: 'Instructions pour la commande',
    needHelp: 'Besoin d\'aide ?',
    needHelpBody:
      'Pour toute question sur votre commande, contactez-nous — nous sommes là pour vous aider.',
    call: 'Appeler',
    email: 'E-mail',
    autoMessage:
      'Ceci est un message automatique — merci de ne pas répondre directement à cet e-mail.',
    statusAccepted: 'Acceptée',
    statusReady: 'Prête',
    statusOnTheWay: 'En livraison',
    statusCancelled: 'Annulée',
    headlineAccepted: 'Votre commande est en route vers la cuisine',
    headlineReady: 'Votre commande est prête',
    headlineOnTheWay: 'Votre commande est en route',
    headlineCancelled: 'Votre commande a été annulée',
    etaMinutes: (m) => `Estimation ~${m} min.`,
    fulfillmentTakeaway: 'À emporter',
    fulfillmentDelivery: 'Livraison',
    fulfillmentDineIn: 'Sur place',
    paymentCash: 'Espèces',
    paymentCard: 'Carte',
    paymentPayLater: 'Espèces',
    paymentOnline: 'En ligne',
  },
  de: {
    orderConfirmedBadge: 'BESTELLUNG BESTÄTIGT',
    orderStatusLabel: 'BESTELLSTATUS',
    thankYou: (name) => `Danke, ${name}!`,
    orderType: 'Bestellart',
    payment: 'Zahlung',
    total: 'Total',
    qty: 'Menge',
    item: 'Artikel',
    unit: 'Einheit',
    lineTotal: 'Zwischensumme',
    subtotal: 'Zwischensumme',
    discount: 'Rabatt',
    summary: 'Zusammenfassung',
    pickupAt: 'Abholung bei',
    deliverTo: 'Lieferung an',
    scheduledFor: 'Geplant für',
    orderInstructions: 'Bestellhinweise',
    needHelp: 'Brauchen Sie Hilfe?',
    needHelpBody:
      'Bei Fragen zu Ihrer Bestellung kontaktieren Sie uns — wir helfen Ihnen gerne.',
    call: 'Anrufen',
    email: 'E-Mail',
    autoMessage:
      'Dies ist eine automatische Nachricht — bitte antworten Sie nicht direkt auf diese E-Mail.',
    statusAccepted: 'Angenommen',
    statusReady: 'Bereit',
    statusOnTheWay: 'Unterwegs',
    statusCancelled: 'Storniert',
    headlineAccepted: 'Ihre Bestellung ist auf dem Weg in die Küche',
    headlineReady: 'Ihre Bestellung ist bereit',
    headlineOnTheWay: 'Ihre Bestellung ist unterwegs',
    headlineCancelled: 'Ihre Bestellung wurde storniert',
    etaMinutes: (m) => `Geschätzt ~${m} Min.`,
    fulfillmentTakeaway: 'Zum Mitnehmen',
    fulfillmentDelivery: 'Lieferung',
    fulfillmentDineIn: 'Vor Ort',
    paymentCash: 'Bar',
    paymentCard: 'Karte',
    paymentPayLater: 'Bar bei Abholung',
    paymentOnline: 'Online',
  },
};

export function shopOrderEmailLabels(locale?: string | null): ShopOrderEmailLabels {
  return SHOP_ORDER_LABELS[loc(locale)];
}

export function shopOrderPaymentLabel(method: string | null | undefined, locale?: string | null): string {
  const labels = shopOrderEmailLabels(locale);
  const m = String(method || '').toLowerCase();
  if (m === 'card' || m === 'terminal') return labels.paymentCard;
  if (m === 'pay_later') return labels.paymentPayLater;
  if (m === 'online') return labels.paymentOnline;
  return labels.paymentCash;
}

export function shopOrderFulfillmentLabel(
  channel: string | null | undefined,
  locale?: string | null
): string {
  const labels = shopOrderEmailLabels(locale);
  const c = String(channel || '').toLowerCase();
  if (c === 'delivery') return labels.fulfillmentDelivery;
  if (c === 'dine_in' || c === 'dine-in') return labels.fulfillmentDineIn;
  return labels.fulfillmentTakeaway;
}
