/** Map stored cancel/reject reason (id or localized label) to shop i18n keys. */
const REASON_I18N: Record<string, string> = {
  kitchen_busy: 'orderRejectKitchenBusy',
  out_of_stock: 'orderRejectOutOfStock',
  could_not_process: 'orderRejectCouldNotProcess',
  client_cancel: 'orderRejectClientCancel',
  wrong_order: 'webPosCancelReasonWrong',
  other: 'orderRejectOther',
};

const REASON_TEXT_ALIASES: Record<string, string> = {
  'kitchen too busy': 'kitchen_busy',
  'cuisine trop occupée': 'kitchen_busy',
  'küche überlastet': 'kitchen_busy',
  'out of stock': 'out_of_stock',
  'rupture de stock': 'out_of_stock',
  'nicht vorrätig': 'out_of_stock',
  'could not process order': 'could_not_process',
  'impossible de traiter la commande': 'could_not_process',
  'impossible de traiter': 'could_not_process',
  'bestellung konnte nicht verarbeitet werden': 'could_not_process',
  'bestellung nicht verarbeitbar': 'could_not_process',
  'client cancellation': 'client_cancel',
  'annulation client': 'client_cancel',
  'stornierung durch gast': 'client_cancel',
  'kundenstorno': 'client_cancel',
  'wrong order entered': 'wrong_order',
  'mauvaise commande saisie': 'wrong_order',
  'falsche bestellung erfasst': 'wrong_order',
  other: 'other',
  autre: 'other',
  sonstiges: 'other',
};

/** Customer-facing label for a stored cancel/reject reason. */
export function formatShopCancelReason(
  reason: string | null | undefined,
  t: (key: string) => string
): string {
  const raw = String(reason || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const id = REASON_I18N[lower] ? lower : REASON_TEXT_ALIASES[lower];
  if (id && REASON_I18N[id]) {
    const translated = t(REASON_I18N[id]);
    if (translated !== REASON_I18N[id]) return translated;
  }
  return raw;
}
