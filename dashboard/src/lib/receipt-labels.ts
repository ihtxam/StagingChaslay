import { normalizePaymentMethod } from '@/lib/payment-breakdown';

export type ReceiptLang = 'en' | 'fr' | 'de';

export type ReceiptLabels = {
  date: string;
  sale: string;
  channel: string;
  table: string;
  subtotal: string;
  discount: string;
  tax: string;
  rounding: string;
  total: string;
  payment: string;
  paid: string;
  tendered: string;
  change: string;
  note: string;
  staff: string;
  scanDigitalReceipt: string;
  thankYou: string;
  kitchen: string;
  /** Kitchen void / cancel ticket title */
  cancelledTicket: string;
  dineIn: string;
  takeaway: string;
  delivery: string;
  cash: string;
  card: string;
  terminal: string;
  express: string;
  pax: string;
  endOfDay: string;
  endOfShift: string;
  mySales: string;
  reportPeriod: string;
  salesSummary: string;
  salesCount: string;
  revenue: string;
  productsSold: string;
  cancelled: string;
  refunds: string;
  covers: string;
  tipsNotTaxable: string;
  /** Taxable sales total (order totals minus tips) */
  netSalesExclTips: string;
  grandTotal: string;
  orders: string;
  guestsServed: string;
  paymentMethods: string;
  orderTypes: string;
  tva: string;
  type: string;
  net: string;
  brut: string;
  totalQty: string;
  pickupTime: string;
  deliveryTime: string;
  asap: string;
  payLater: string;
  /** Unused leftover; Pay Later receipts always name one collected tender. */
  or: string;
  invoice: string;
  totalItems: string;
  vatIncludedNote: string;
  tip: string;
  customer: string;
  deliveryAddress: string;
  cashDrawer: string;
  openingFloat: string;
  cashSalesDuringShift: string;
  cashInDuringShift: string;
  cashOutDuringShift: string;
  cashRefundsDuringShift: string;
  expectedInDrawer: string;
  expectedDrawerFormula: string;
  countedClosingCash: string;
  cashVariance: string;
  floatCarriesForward: string;
  floatCarriesForwardNote: string;
  giftCardTitle: string;
  giftCardCode: string;
  giftCardBalance: string;
  giftCardRemainingBalance: string;
  giftCardScanRedeem: string;
  member: string;
  pointsEarned: string;
  pointsBalance: string;
  /** Kitchen / guest receipt course banner, e.g. >> COURSE 1 << */
  courseLabel: string;
};

const EN: ReceiptLabels = {
  date: 'Date',
  sale: 'Sale',
  channel: 'Channel',
  table: 'Table',
  subtotal: 'Subtotal',
  discount: 'Discount',
  tax: 'Tax',
  rounding: 'Rounding',
  total: 'TOTAL',
  payment: 'Payment',
  paid: 'Paid',
  tendered: 'Tendered',
  change: 'Change',
  note: 'Note',
  staff: 'Staff',
  scanDigitalReceipt: 'Scan for digital receipt',
  thankYou: 'Thank you',
  kitchen: 'KITCHEN',
  cancelledTicket: 'CANCELLED',
  dineIn: 'DINE-IN',
  takeaway: 'TAKEAWAY',
  delivery: 'DELIVERY',
  cash: 'Cash',
  card: 'Card',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'PAX',
  endOfDay: 'END OF DAY',
  endOfShift: 'END OF SHIFT',
  mySales: 'My sales',
  reportPeriod: 'Report Period',
  salesSummary: 'SALES SUMMARY',
  salesCount: 'Sales',
  revenue: 'Revenue',
  productsSold: 'PRODUCTS SOLD',
  cancelled: 'Cancelled',
  refunds: 'Refunds',
  covers: 'Covers',
  tipsNotTaxable: 'Tips (not taxable)',
  netSalesExclTips: 'Net sales (excl. tips)',
  grandTotal: 'GRAND TOTAL',
  orders: 'Orders',
  guestsServed: 'Guests served',
  paymentMethods: 'PAYMENT METHODS',
  orderTypes: 'ORDER TYPES',
  tva: 'TVA',
  type: 'Type',
  net: 'Net',
  brut: 'Brut',
  totalQty: 'Total qty',
  pickupTime: 'Pickup:',
  deliveryTime: 'Delivery:',
  asap: 'ASAP',
  payLater: 'Pay Later',
  or: 'or',
  invoice: 'Invoice',
  totalItems: 'Items',
  vatIncludedNote: 'VAT included in prices',
  tip: 'Tip',
  customer: 'Customer',
  deliveryAddress: 'Delivery address',
  cashDrawer: 'CASH DRAWER',
  openingFloat: 'Opening float',
  cashSalesDuringShift: 'Cash sales (shift)',
  cashInDuringShift: 'Cash in',
  cashOutDuringShift: 'Cash out',
  cashRefundsDuringShift: 'Cash refunds',
  expectedInDrawer: 'Expected in drawer',
  expectedDrawerFormula: 'Expected = float + cash sales + cash in - cash out - refunds',
  countedClosingCash: 'Counted / closing cash',
  cashVariance: 'Variance',
  floatCarriesForward: 'Carries forward as base',
  floatCarriesForwardNote:
    'Opening float stays in the drawer as the next shift starting till.',
  giftCardTitle: 'GIFT CARD',
  giftCardCode: 'Code',
  giftCardBalance: 'Balance',
  giftCardRemainingBalance: 'Gift card remaining',
  giftCardScanRedeem: 'Scan barcode to redeem',
  member: 'Member',
  pointsEarned: 'Points this sale',
  pointsBalance: 'Points so far',
  courseLabel: 'COURSE',
};

const FR: ReceiptLabels = {
  date: 'Date',
  sale: 'Vente',
  channel: 'Canal',
  table: 'Table',
  subtotal: 'Sous-total',
  discount: 'Remise',
  tax: 'TVA',
  rounding: 'Arrondi',
  total: 'TOTAL',
  payment: 'Paiement',
  paid: 'Payé',
  tendered: 'Remis',
  change: 'Monnaie',
  note: 'Note',
  staff: 'Personnel',
  scanDigitalReceipt: 'Scannez pour le recu digital',
  thankYou: 'Merci',
  kitchen: 'CUISINE',
  cancelledTicket: 'ANNULE',
  dineIn: 'SUR PLACE',
  takeaway: 'EMPORTER',
  delivery: 'LIVRAISON',
  cash: 'Especes',
  card: 'Carte',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'Couverts',
  endOfDay: 'FIN DE JOURNEE',
  endOfShift: 'FIN DE SHIFT',
  mySales: 'Mes ventes',
  reportPeriod: 'Periode du rapport',
  salesSummary: 'RESUME DES VENTES',
  salesCount: 'Ventes',
  revenue: "Chiffre d'affaires",
  productsSold: 'PRODUITS VENDUS',
  cancelled: 'Annulees',
  refunds: 'Remboursements',
  covers: 'Couverts',
  tipsNotTaxable: 'Pourboires (non taxables)',
  netSalesExclTips: 'Ventes nettes (hors pourboires)',
  grandTotal: 'TOTAL GENERAL',
  orders: 'Commandes',
  guestsServed: 'Couverts servis',
  paymentMethods: 'MODES DE PAIEMENT',
  orderTypes: 'TYPES DE COMMANDE',
  tva: 'TVA',
  type: 'Type',
  net: 'Net',
  brut: 'Brut',
  totalQty: 'Qte totale',
  pickupTime: 'Retrait :',
  deliveryTime: 'Livraison :',
  asap: 'Des que possible',
  payLater: 'Paiement différé',
  or: 'ou',
  invoice: 'Facture',
  totalItems: 'Articles',
  vatIncludedNote: 'TVA incluse dans les prix',
  tip: 'Pourboire',
  customer: 'Client',
  deliveryAddress: 'Adresse de livraison',
  cashDrawer: 'CAISSE / FOND DE BASE',
  openingFloat: 'Fond de base',
  cashSalesDuringShift: 'Ventes especes (shift)',
  cashInDuringShift: 'Entree caisse',
  cashOutDuringShift: 'Sortie caisse',
  cashRefundsDuringShift: 'Remb. especes',
  expectedInDrawer: 'Caisse attendue',
  expectedDrawerFormula: 'Attendu = fond + ventes + entrees - sorties - remb.',
  countedClosingCash: 'Especes comptees',
  cashVariance: 'Ecart',
  floatCarriesForward: 'Se reporte (fond suivant)',
  floatCarriesForwardNote:
    'Le fond de base reste en caisse et se reporte comme prochain fond d\'ouverture.',
  giftCardTitle: 'CARTE CADEAU',
  giftCardCode: 'Code',
  giftCardBalance: 'Solde',
  giftCardRemainingBalance: 'Solde carte cadeau',
  giftCardScanRedeem: 'Scannez le code-barres pour payer',
  member: 'Membre',
  pointsEarned: 'Points cette vente',
  pointsBalance: 'Points accumulés',
  courseLabel: 'PLAT',
};

const DE: ReceiptLabels = {
  date: 'Datum',
  sale: 'Verkauf',
  channel: 'Kanal',
  table: 'Tisch',
  subtotal: 'Zwischensumme',
  discount: 'Rabatt',
  tax: 'MwSt.',
  rounding: 'Rundung',
  total: 'TOTAL',
  payment: 'Zahlung',
  paid: 'Bezahlt',
  tendered: 'Gegeben',
  change: 'Rueckgeld',
  note: 'Notiz',
  staff: 'Personal',
  scanDigitalReceipt: 'Scannen fuer digitalen Beleg',
  thankYou: 'Danke',
  kitchen: 'KUECHE',
  cancelledTicket: 'STORNIERT',
  dineIn: 'VOR ORT',
  takeaway: 'ZUM MITNEHMEN',
  delivery: 'LIEFERUNG',
  cash: 'Bar',
  card: 'Karte',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'Gaeste',
  endOfDay: 'TAGESABSCHLUSS',
  endOfShift: 'SCHICHTENDE',
  mySales: 'Meine Verkaeufe',
  reportPeriod: 'Berichtszeitraum',
  salesSummary: 'VERKAUFSUEBERSICHT',
  salesCount: 'Verkaeufe',
  revenue: 'Umsatz',
  productsSold: 'VERKAUFTE PRODUKTE',
  cancelled: 'Storniert',
  refunds: 'Rueckerstattungen',
  covers: 'Gedecke',
  tipsNotTaxable: 'Trinkgeld (nicht steuerpflichtig)',
  netSalesExclTips: 'Nettoumsatz (ohne Trinkgeld)',
  grandTotal: 'GESAMTSUMME',
  orders: 'Bestellungen',
  guestsServed: 'Gaeste bedient',
  paymentMethods: 'ZAHLUNGSARTEN',
  orderTypes: 'BESTELLARTEN',
  tva: 'MwSt.',
  type: 'Typ',
  net: 'Netto',
  brut: 'Brutto',
  totalQty: 'Menge gesamt',
  pickupTime: 'Abholung:',
  deliveryTime: 'Lieferung:',
  asap: 'Sofort',
  payLater: 'Später zahlen',
  or: 'oder',
  invoice: 'Rechnung',
  totalItems: 'Artikel',
  vatIncludedNote: 'MwSt. im Preis enthalten',
  tip: 'Trinkgeld',
  customer: 'Kunde',
  deliveryAddress: 'Lieferadresse',
  cashDrawer: 'KASSENABSTIMMUNG',
  openingFloat: 'Anfangsbestand',
  cashSalesDuringShift: 'Barverkaeufe (Schicht)',
  cashInDuringShift: 'Bareinlage',
  cashOutDuringShift: 'Barentnahme',
  cashRefundsDuringShift: 'Barrueckerstattung',
  expectedInDrawer: 'Erwarteter Bestand',
  expectedDrawerFormula: 'Erwartet = Anfang + Verkauf + Einlage - Entnahme - Rueck.',
  countedClosingCash: 'Gezaehltes Bargeld',
  cashVariance: 'Differenz',
  floatCarriesForward: 'Bleibt als Wechselgeld',
  floatCarriesForwardNote:
    'Der Anfangsbestand bleibt in der Kasse und ist der Startbestand der naechsten Schicht.',
  giftCardTitle: 'GESCHENKKARTE',
  giftCardCode: 'Code',
  giftCardBalance: 'Guthaben',
  giftCardRemainingBalance: 'Guthaben Geschenkkarte',
  giftCardScanRedeem: 'Barcode an der Kasse scannen',
  member: 'Mitglied',
  pointsEarned: 'Punkte dieser Verkauf',
  pointsBalance: 'Punkte bisher',
  courseLabel: 'GANG',
};

export function receiptLabels(lang: string | null | undefined): ReceiptLabels {
  const code = String(lang || 'en').toLowerCase().slice(0, 2);
  if (code === 'fr') return FR;
  if (code === 'de') return DE;
  return EN;
}

export function channelLabel(labels: ReceiptLabels, channel?: string | null): string {
  if (channel === 'dine_in') return labels.dineIn;
  if (channel === 'delivery') return labels.delivery;
  return labels.takeaway;
}

export function isPayLaterPaymentMethod(method?: string | null): boolean {
  return /^pay[_-]?later/i.test(String(method || ''));
}

export function payLaterCollectedTender(
  method?: string | null
): 'cash' | 'card' | 'terminal' | null {
  const raw = String(method || '').trim();
  const later = raw.match(/^pay[_-]?later(?::|_|\s+)(.+)$/i);
  const intent = normalizePaymentMethod(later?.[1] || raw);
  if (intent === 'cash') return 'cash';
  if (intent === 'card') return 'card';
  if (intent === 'terminal') return 'terminal';
  return null;
}

/** Pay Later line: "Pay Later: Cash" (one collected tender, never "Cash or Card or Terminal"). */
export function formatPayLaterPaymentLabel(
  labels: ReceiptLabels,
  preferredTender?: string | null
): string {
  const intent = payLaterCollectedTender(preferredTender) || normalizePaymentMethod(String(preferredTender || ''));
  if (intent === 'cash') return `${labels.payLater}: ${labels.cash}`;
  if (intent === 'card') return `${labels.payLater}: ${labels.card}`;
  if (intent === 'terminal') return `${labels.payLater}: ${labels.terminal}`;
  return labels.payLater;
}

export function paymentLabel(labels: ReceiptLabels, method?: string | null): string {
  const raw = String(method || '').trim();
  const later = raw.match(/^pay[_-]?later(?::|_|\s+)?(.*)$/i);
  if (later) {
    return formatPayLaterPaymentLabel(labels, later[1] || '');
  }
  const m = normalizePaymentMethod(raw);
  if (m === 'cash') return labels.cash;
  if (m === 'card') return labels.card;
  if (m === 'terminal') return labels.terminal;
  if (m === 'pay_later') return formatPayLaterPaymentLabel(labels);
  if (m === 'invoice') return labels.invoice || 'Invoice';
  if (m === 'bank_transfer') return 'Bank transfer';
  if (m === 'gift_card') return 'Gift card';
  if (m === 'mixed') return 'Mixed';
  return String(method || '').toUpperCase();
}

export function lineWidthForPaper(mm?: number | null): number {
  return Number(mm) === 58 ? 32 : 48;
}
