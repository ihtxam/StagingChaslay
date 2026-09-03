export type SettingsTabId =
  | 'business'
  | 'taxes'
  | 'tables'
  | 'shop'
  | 'delivery'
  | 'delivery-map'
  | 'hours'
  | 'reservations'
  | 'pos'
  | 'payments'
  | 'receipt'
  | 'kds'
  | 'ods'
  | 'signage'
  | 'kiosk'
  | 'email'
  | 'language'
  | 'users';

export type SettingsSearchEntry = {
  id: string;
  tab: SettingsTabId;
  keywords: string[];
};

export type SettingsSearchContext = {
  visibleTabIds: ReadonlySet<SettingsTabId>;
  canOpenTab: (tab: SettingsTabId) => boolean;
  isSectionRendered: (id: string) => boolean;
};

export function normalizeSettingsSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function keywordMatchesSettingsQuery(keyword: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return false;
  return String(keyword ?? '').toLowerCase().includes(normalizedQuery);
}

export function matchSettingsSearch(
  index: SettingsSearchEntry[],
  normalizedQuery: string
): SettingsSearchEntry[] {
  if (!normalizedQuery) return [];
  return index.filter((entry) =>
    entry.keywords.some((keyword) => keywordMatchesSettingsQuery(keyword, normalizedQuery))
  );
}

export function filterAccessibleSettingsSearch(
  matches: SettingsSearchEntry[],
  context: SettingsSearchContext
): SettingsSearchEntry[] {
  return matches.filter(
    (entry) =>
      context.visibleTabIds.has(entry.tab) &&
      context.canOpenTab(entry.tab) &&
      context.isSectionRendered(entry.id)
  );
}

export function pickSettingsSearchMatch(
  matches: SettingsSearchEntry[],
  currentTab: SettingsTabId
): SettingsSearchEntry | null {
  if (!matches.length) return null;
  return matches.find((entry) => entry.tab === currentTab) ?? matches[0];
}

/** Tab whose panel should render while searching (avoids blank flash before URL/state sync). */
export function resolveSettingsContentTab(
  currentTab: SettingsTabId,
  normalizedQuery: string,
  matches: SettingsSearchEntry[]
): SettingsTabId {
  if (!normalizedQuery || matches.length === 0) return currentTab;
  return pickSettingsSearchMatch(matches, currentTab)?.tab ?? currentTab;
}

export function hasSettingsSearchMatchesOnTab(
  matches: SettingsSearchEntry[],
  tab: SettingsTabId
): boolean {
  return matches.some((entry) => entry.tab === tab);
}

/**
 * Dimming non-matching sections caused a blank-looking panel on ?tab=pos when matches
 * lived on another tab or below the fold. Highlight + results list only.
 */
export function shouldDimSettingsSectionDuringSearch(): boolean {
  return false;
}

export function buildSettingsSearchIndex(
  t: (key: string) => string
): SettingsSearchEntry[] {
  return [
    {
      id: 'pos-mode',
      tab: 'pos',
      keywords: [
        'pos mode',
        'retail',
        'restaurant',
        'barcode',
        'mode',
        'magasin',
        'einzelhandel',
        'gastronomie',
        'tables',
        'fast food',
        'fast-food',
        'counter',
        t('posMode'),
        t('posModeRetail'),
        t('posModeRestaurant'),
        t('posTablesEnabled'),
      ],
    },
    {
      id: 'pos-layout',
      tab: 'pos',
      keywords: [
        'cart',
        'cart side',
        'cart position',
        'left',
        'right',
        'layout',
        'panier',
        'position panier',
        'gauche',
        'droite',
        'warenkorb',
        'position',
        'links',
        'rechts',
        'post success',
        'after payment',
        'navigate',
        'après paiement',
        'nach zahlung',
        'theme',
        'color',
        'couleur',
        'farbe',
        'teal',
        'violet',
        t('posCartSide'),
        t('posCartSideLeft'),
        t('posCartSideRight'),
        t('webPosPostSuccessNav'),
        t('posColorTheme'),
        t('posLayoutSettings'),
      ],
    },
    {
      id: 'pos-courses',
      tab: 'pos',
      keywords: [
        'courses',
        'course',
        'cours',
        'gänge',
        'gange',
        'gang',
        'fire',
        'kitchen',
        'send mode',
        t('coursesEnabled'),
        t('courseSendMode'),
      ],
    },
    {
      id: 'pos-checkout',
      tab: 'pos',
      keywords: [
        'tips',
        'pourboire',
        'trinkgeld',
        'discount',
        'remise',
        'rabatt',
        'quick cash',
        'split',
        'checkout',
        'express',
        'express checkout',
        t('posCheckoutSettings'),
        t('tipsEnabled'),
        t('discountsEnabled'),
        t('quickCashEnabled'),
        t('splitBillsEnabled'),
        t('expressCheckoutEnabled'),
      ],
    },
    {
      id: 'pos-payments',
      tab: 'pos',
      keywords: [
        'cash',
        'card',
        'terminal',
        'paiement',
        'zahlung',
        t('webposPaymentMethods'),
        t('webposCash'),
        t('webposCard'),
        t('webposTerminal'),
      ],
    },
    {
      id: 'pos-shifts',
      tab: 'pos',
      keywords: [
        'shift',
        'shifts',
        'caisse',
        'kasse',
        'float',
        'operations',
        'opérations',
        t('settingsOperations'),
        t('shiftsEnabled'),
        t('webPosShiftMenu'),
      ],
    },
    {
      id: 'pos-posts',
      tab: 'pos',
      keywords: ['pos posts', 'waiter posts', 'posts', t('posPostsTitle')],
    },
    {
      id: 'tables-floor',
      tab: 'tables',
      keywords: ['tables', 'floor', 'plan', 'pax', t('floorPlanEnabled'), t('paxOrderingEnabled')],
    },
    {
      id: 'tables-management',
      tab: 'tables',
      keywords: [
        'table',
        'tables',
        'section',
        'layout',
        'qr',
        t('navTableManagement'),
        t('tableNavSettings'),
        t('tableNavLayout'),
        t('tableNavQr'),
      ],
    },
    {
      id: 'payments-adyen',
      tab: 'payments',
      keywords: [
        'adyen',
        'swisspayout',
        'terminal',
        'tap to pay',
        'softpos',
        t('adyenCredentials'),
        t('tapToPaySettings'),
      ],
    },
    {
      id: 'payments-tap-to-pay',
      tab: 'payments',
      keywords: ['tap to pay', 'nfc', 'softpos', 'android', t('tapToPaySettings'), t('tapToPayEnabled')],
    },
    {
      id: 'business-profile',
      tab: 'business',
      keywords: ['business', 'name', 'address', 'vat', t('businessSettings')],
    },
    {
      id: 'taxes-rates',
      tab: 'taxes',
      keywords: ['tax', 'vat', 'tva', 'mwst', t('taxRates')],
    },
    {
      id: 'shop-online',
      tab: 'shop',
      keywords: [
        'shop',
        'online',
        'domain',
        'subdomain',
        'photo',
        'photos',
        'image',
        'images',
        'product photo',
        'menu photo',
        t('shop'),
        t('shopShowProductPhotos'),
        t('shopMenuPhotos'),
      ],
    },
    {
      id: 'delivery-platforms',
      tab: 'delivery',
      keywords: [
        'just eat',
        'uber eats',
        'delivery',
        'aggregator',
        'webhook',
        t('settingsDeliveryPlatforms'),
        t('deliveryPlatformJustEat'),
        t('deliveryPlatformUberEats'),
      ],
    },
    {
      id: 'hours-schedule',
      tab: 'hours',
      keywords: ['hours', 'opening', 'pickup', 'delivery', 'dine', 'schedule', t('settingsHours')],
    },
    {
      id: 'reservations-config',
      tab: 'reservations',
      keywords: ['reservations', 'booking', 'slots', t('settingsReservations'), t('reservationsEnable')],
    },
    {
      id: 'receipt-print',
      tab: 'receipt',
      keywords: ['receipt', 'printer', 'kitchen', 'ticket', t('settingsReceipt')],
    },
    {
      id: 'barcode-labels',
      tab: 'receipt',
      keywords: ['barcode', 'label', 'code128', t('barcodeLabelsTitle')],
    },
    {
      id: 'inventory-addon',
      tab: 'pos',
      keywords: ['inventory', 'stock', 'recipe', 'supplier', t('invTitle')],
    },
    {
      id: 'storekeeper-addon',
      tab: 'pos',
      keywords: ['storekeeper', 'barcode', 'scan', 'intake', t('storekeeperTitle')],
    },
    {
      id: 'signage-addon',
      tab: 'pos',
      keywords: ['signage', 'tv', 'menu board', 'screens', 'playlist', t('signageTitle'), t('signageNav')],
    },
    {
      id: 'kiosk-setup',
      tab: 'kiosk',
      keywords: ['kiosk', 'self order', 'attract', 'slider', t('kioskNav')],
    },
    {
      id: 'email-smtp',
      tab: 'email',
      keywords: [
        'email',
        'smtp',
        'brevo',
        'sendinblue',
        'api',
        'marketing',
        'newsletter',
        t('settingsEmail'),
        t('settingsBrevo'),
      ],
    },
    {
      id: 'email-brevo',
      tab: 'email',
      keywords: ['brevo', 'sendinblue', 'api key', 'newsletter', t('settingsBrevo')],
    },
    {
      id: 'language-panel',
      tab: 'language',
      keywords: ['language', 'langue', 'sprache', t('language')],
    },
  ];
}
