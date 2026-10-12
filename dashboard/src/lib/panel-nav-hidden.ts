/** Sidebar group ids and route paths a reseller can hide from a merchant panel. */
export const PANEL_NAV_GROUP_PATHS: Record<string, string[]> = {
  retail: [
    '/merchant/products',
    '/merchant/categories',
    '/merchant/modifiers',
    '/merchant/products/catering-guide',
    '/merchant/products/scheduled-menus',
    '/merchant/products/pizza-builder',
  ],
  products: [
    '/merchant/products',
    '/merchant/categories',
    '/merchant/modifiers',
    '/merchant/products/catering-guide',
    '/merchant/products/scheduled-menus',
    '/merchant/products/pizza-builder',
  ],
  sales: [
    '/merchant/orders',
    '/merchant/order-center',
    '/merchant/order-hub',
    '/merchant/sales/reservations',
    '/merchant/sales/host',
    '/merchant/reports',
  ],
  catalog: [
    '/merchant/products',
    '/merchant/categories',
    '/merchant/modifiers',
    '/merchant/products/catering-guide',
    '/merchant/products/scheduled-menus',
    '/merchant/products/pizza-builder',
  ],
  hq: ['/merchant/hq', '/merchant/hq/menus', '/merchant/hq/bulk-pricing'],
  inventory: [
    '/merchant/inventory',
    '/merchant/inventory/list',
    '/merchant/inventory/inbound',
    '/merchant/inventory/outbound',
    '/merchant/inventory/counting',
    '/merchant/inventory/history',
    '/merchant/inventory/items',
    '/merchant/inventory/categories',
    '/merchant/inventory/cookbook',
    '/merchant/inventory/suppliers',
    '/merchant/inventory/units',
    '/merchant/inventory/report',
    '/merchant/inventory/dead-stock',
    '/merchant/inventory/consumption',
    '/merchant/storekeeper',
  ],
  customers: [
    '/merchant/customers',
    '/merchant/members',
    '/merchant/loyalty',
    '/merchant/offers',
    '/merchant/vouchers',
    '/merchant/newsletter',
  ],
  cms: [
    '/merchant/online-shop',
    '/merchant/website',
    '/merchant/chaslay-page-builder',
    '/merchant/shop-seo-footer',
  ],
  'platform-shop': ['/merchant/platform-shop'],
};

/** Menu group id `products` and stored key `catalog` are the same reseller checkbox. */
export const PANEL_NAV_GROUP_ALIASES: Record<string, string[]> = {
  products: ['catalog', 'retail'],
  catalog: ['products', 'retail'],
  retail: ['products', 'catalog'],
};

export const PANEL_NAV_HIDE_OPTIONS: Array<{ key: string; labelKey: string }> = [
  { key: 'cms', labelKey: 'panelNavHideCms' },
  { key: 'customers', labelKey: 'panelNavHideCustomers' },
  { key: '/merchant/online-shop', labelKey: 'panelNavHideShop' },
  { key: '/merchant/chaslay-page-builder', labelKey: 'panelNavHideWebsite' },
  { key: 'sales', labelKey: 'panelNavHideSales' },
  { key: 'products', labelKey: 'panelNavHideCatalog' },
  { key: 'inventory', labelKey: 'panelNavHideInventory' },
  { key: 'hq', labelKey: 'panelNavHideHq' },
  { key: 'platform-shop', labelKey: 'panelNavHidePlatformShop' },
];

export function parsePanelNavHidden(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      const key = String(item ?? '').trim();
      if (key && !out.includes(key)) out.push(key);
    }
    return out;
  }
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (parsed !== text) return parsePanelNavHidden(parsed);
    } catch {
      /* comma-separated fallback */
    }
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, all) => all.indexOf(item) === index);
  }
  return [];
}

function normalizePath(raw: string): string {
  const base = String(raw || '')
    .trim()
    .split('?')[0]
    .replace(/\/$/, '');
  return base || '/merchant';
}

function listHasGroup(list: string[], groupId: string): boolean {
  if (list.includes(groupId)) return true;
  return (PANEL_NAV_GROUP_ALIASES[groupId] || []).some((alias) => list.includes(alias));
}

export function isPanelNavHidden(path: string, hidden: string[] | null | undefined): boolean {
  const list = parsePanelNavHidden(hidden);
  if (!list.length) return false;
  const normalized = normalizePath(path);
  if (list.includes(normalized)) return true;
  for (const [groupId, paths] of Object.entries(PANEL_NAV_GROUP_PATHS)) {
    if (!list.includes(groupId)) continue;
    if (paths.some((p) => normalized === p || normalized.startsWith(`${p}/`))) return true;
  }
  return false;
}

export function isPanelNavGroupHidden(groupId: string, hidden: string[] | null | undefined): boolean {
  const list = parsePanelNavHidden(hidden);
  if (!list.length) return false;
  if (listHasGroup(list, groupId)) return true;
  const paths = PANEL_NAV_GROUP_PATHS[groupId];
  if (!paths?.length) return false;
  return paths.every((path) => list.includes(path) || isPanelNavHidden(path, list));
}

export function isPanelNavOptionChecked(key: string, hidden: string[] | null | undefined): boolean {
  const list = parsePanelNavHidden(hidden);
  if (list.includes(key)) return true;
  return (PANEL_NAV_GROUP_ALIASES[key] || []).some((alias) => list.includes(alias));
}

export function togglePanelNavOption(
  hidden: string[] | null | undefined,
  key: string,
  checked: boolean
): string[] {
  const list = parsePanelNavHidden(hidden);
  const related = [key, ...(PANEL_NAV_GROUP_ALIASES[key] || [])];
  if (checked) {
    return list.includes(key) ? list : [...list, key];
  }
  return list.filter((item) => !related.includes(item));
}
