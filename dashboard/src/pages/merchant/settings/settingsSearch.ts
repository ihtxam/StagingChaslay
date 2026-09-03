/** Live-bundle grep marker: search-click-v6 */
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

/**
 * Split a settings search box value into tokens.
 * Empty tokens from a trailing space / double space ("foo ", "foo  bar")
 * are dropped — [].every() is true in JS and would otherwise match every section.
 */
export function tokenizeSettingsSearchQuery(query: string): string[] {
  return String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function normalizeSettingsSearchQuery(query: string): string {
  return tokenizeSettingsSearchQuery(query).join(' ');
}

export function keywordMatchesSettingsQuery(keyword: string, normalizedQuery: string): boolean {
  const tokens = tokenizeSettingsSearchQuery(normalizedQuery);
  if (!tokens.length) return false;
  const haystack = String(keyword ?? '').toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function entrySearchHaystack(entry: SettingsSearchEntry | null | undefined): string {
  const keywords = Array.isArray(entry?.keywords) ? entry.keywords : [];
  return keywords.map((keyword) => String(keyword ?? '').toLowerCase()).join(' ');
}

/** All tokens must appear in the entry (across keywords). Phrase-only includes() failed on the second word. */
export function entryMatchesSettingsTokens(
  entry: SettingsSearchEntry | null | undefined,
  tokens: string[]
): boolean {
  if (!entry || !tokens.length) return false;
  const haystack = entrySearchHaystack(entry);
  return tokens.every((token) => haystack.includes(token));
}

export function formatSettingsSearchSectionLabel(id: string | undefined | null): string {
  const parts = String(id ?? '')
    .split(/[-_]+/)
    .filter((part) => part.length > 0);
  if (!parts.length) return 'Setting';
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function matchSettingsSearch(
  index: SettingsSearchEntry[],
  query: string
): SettingsSearchEntry[] {
  try {
    const tokens = tokenizeSettingsSearchQuery(query);
    if (!tokens.length) return [];
    const list = Array.isArray(index) ? index : [];
    return list.filter((entry) => entryMatchesSettingsTokens(entry, tokens));
  } catch {
    return [];
  }
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

export type SettingsSearchResultClickPlan = {
  tab: SettingsTabId;
  highlightId: string;
  shouldSwitchTab: boolean;
};

/**
 * Result-row click: go to THAT row's tab. Never invent tab=pos.
 * Same-tab clicks must not remount (caller skips selectTab).
 */
export function planSettingsSearchResultClick(
  entry: SettingsSearchEntry | null | undefined,
  currentTab: SettingsTabId
): SettingsSearchResultClickPlan | null {
  if (!entry?.id || !entry.tab) return null;
  return {
    tab: entry.tab,
    highlightId: entry.id,
    shouldSwitchTab: entry.tab !== currentTab,
  };
}

export function isSettingsSearchQueryActive(query?: string | null): boolean {
  return String(query ?? '').trim().length > 0;
}

/**
 * Retail merchants used to bounce tables → POS. That steal must not run while
 * search is open (clicking a non-POS hit then getting forced onto ?tab=pos).
 */
export function nextTabForHiddenRetailSettings(
  tab: SettingsTabId,
  ctx: {
    showTablesSettings: boolean;
    isRetailMerchant: boolean;
    query?: string | null;
  }
): SettingsTabId | null {
  if (isSettingsSearchQueryActive(ctx.query)) return null;
  if (tab === 'tables' && !ctx.showTablesSettings) return 'pos';
  if (tab === 'reservations' && ctx.isRetailMerchant) return 'business';
  return null;
}

function overflowYOf(el: Element): string {
  try {
    return (window.getComputedStyle(el).overflowY || '').toLowerCase();
  } catch {
    return '';
  }
}

function isSafeScrollport(el: HTMLElement): boolean {
  const oy = overflowYOf(el);
  if (oy !== 'auto' && oy !== 'scroll') return false;
  return el.scrollHeight > el.clientHeight + 2;
}

/**
 * Scroll a mounted #id into view without Element.scrollIntoView.
 * scrollIntoView walks overflow:hidden ancestors (panel-shell, settings card,
 * report cards) and sets their scrollTop — that clips the POS tab to empty.
 * Taxes/Payments looked fine because taxes-rates had no DOM id (no scroll)
 * and payments sections sit near the top of a short panel.
 */
export function scrollToSettingsSearchSection(id: string | undefined | null): boolean {
  try {
    if (!id || typeof document === 'undefined') return false;
    const el = document.getElementById(id);
    if (!el) return false;
    let parent = el.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (isSafeScrollport(parent)) {
        const parentRect = parent.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const nextTop = parent.scrollTop + (rect.top - parentRect.top) - 16;
        if (typeof parent.scrollTo === 'function') {
          parent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        } else {
          parent.scrollTop = Math.max(0, nextTop);
        }
        return true;
      }
      parent = parent.parentElement;
    }
    const rect = el.getBoundingClientRect();
    const top = (window.scrollY || document.documentElement.scrollTop || 0) + rect.top - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    return true;
  } catch {
    return false;
  }
}

export function scheduleScrollToSettingsSearchSection(
  id: string | undefined | null,
  onMiss?: () => void
): void {
  if (!id || typeof window === 'undefined') return;
  const maxAttempts = 8;
  const tick = (left: number) => {
    if (scrollToSettingsSearchSection(id)) return;
    if (left <= 1) {
      try {
        onMiss?.();
      } catch {
        /* toast must not throw into Settings */
      }
      return;
    }
    window.setTimeout(() => tick(left - 1), 70);
  };
  window.setTimeout(() => tick(maxAttempts), 40);
}

/**
 * Grep marker for the live staging bundle. Must stay a real string so
 * `curl https://app.chaslay.com/assets/index-*.js` can prove this build is served.
 */
export const SETTINGS_SEARCH_STAY_ON_TAB_MARK = 'search-click-v6';
export const SETTINGS_SEARCH_CLICK_MARK = 'search-click-v6';

export type SettingsSearchView = 'idle' | 'results' | 'empty';

/**
 * Failsafe: any non-empty search box value must map to results OR empty-state.
 * Never "query active but render nothing".
 */
export function settingsSearchView(query: string, matchCount: number): SettingsSearchView {
  if (String(query ?? '').length === 0) return 'idle';
  return matchCount > 0 ? 'results' : 'empty';
}

/**
 * Never change tabs while the merchant is typing. Jumping to the best-match tab
 * unmounted the current panel. Result clicks use planSettingsSearchResultClick
 * (that row's tab) and skip selectTab when already on it.
 */
export function resolveSettingsContentTab(
  currentTab: SettingsTabId,
  _normalizedQuery?: string,
  _matches?: SettingsSearchEntry[]
): SettingsTabId {
  return currentTab;
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
