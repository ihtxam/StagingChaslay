/** Sidebar group ids and route paths a reseller can hide from a merchant panel. */
export const PANEL_NAV_GROUP_PATHS: Record<string, string[]> = {
  sales: [
    "/merchant/orders",
    "/merchant/order-center",
    "/merchant/order-hub",
    "/merchant/sales/reservations",
    "/merchant/reports",
  ],
  catalog: ["/merchant/products", "/merchant/categories", "/merchant/modifiers"],
  hq: ["/merchant/hq", "/merchant/hq/menus", "/merchant/hq/bulk-pricing"],
  inventory: [
    "/merchant/inventory",
    "/merchant/inventory/list",
    "/merchant/inventory/inbound",
    "/merchant/inventory/outbound",
    "/merchant/inventory/counting",
    "/merchant/inventory/history",
    "/merchant/inventory/items",
    "/merchant/inventory/categories",
    "/merchant/inventory/cookbook",
    "/merchant/inventory/suppliers",
    "/merchant/inventory/units",
    "/merchant/inventory/report",
    "/merchant/inventory/dead-stock",
    "/merchant/inventory/consumption",
    "/merchant/storekeeper",
  ],
  customers: [
    "/merchant/customers",
    "/merchant/members",
    "/merchant/loyalty",
    "/merchant/offers",
    "/merchant/vouchers",
    "/merchant/newsletter",
  ],
  cms: ["/merchant/online-shop", "/merchant/chaslay-page-builder"],
};

export const PANEL_NAV_ALLOWED_KEYS = new Set<string>([
  ...Object.keys(PANEL_NAV_GROUP_PATHS),
  ...Object.values(PANEL_NAV_GROUP_PATHS).flat(),
  "platform-shop",
]);

function normalizePath(raw: string): string {
  const base = String(raw || "")
    .trim()
    .split("?")[0]
    .replace(/\/$/, "");
  return base || "/merchant";
}

export function normalizePanelNavHidden(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const key = String(item || "").trim();
    if (!key || !PANEL_NAV_ALLOWED_KEYS.has(key)) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

export function isPanelNavHidden(path: string, hidden: string[] | null | undefined): boolean {
  const list = hidden || [];
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
  return (hidden || []).includes(groupId);
}
