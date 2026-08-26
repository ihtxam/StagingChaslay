import { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { InventoryUpsell, useInventoryLicense } from './shared';

type LinkItem = { to: string; labelKey: string };

const GROUPS: Array<{ titleKey: string; items: LinkItem[] }> = [
  {
    titleKey: 'invNavGroupOps',
    items: [
      { to: '/merchant/inventory', labelKey: 'invNavList' },
      { to: '/merchant/inventory/list', labelKey: 'invNavStockTable' },
      { to: '/merchant/inventory/inbound', labelKey: 'invNavInbound' },
      { to: '/merchant/inventory/outbound', labelKey: 'invNavOutbound' },
      { to: '/merchant/inventory/counting', labelKey: 'invNavCounting' },
      { to: '/merchant/inventory/history', labelKey: 'invNavHistory' },
    ],
  },
  {
    titleKey: 'invNavGroupSettings',
    items: [
      { to: '/merchant/inventory/items', labelKey: 'invNavItems' },
      { to: '/merchant/inventory/categories', labelKey: 'invNavCategories' },
      { to: '/merchant/inventory/cookbook', labelKey: 'invNavCookbook' },
      { to: '/merchant/inventory/suppliers', labelKey: 'invNavSuppliers' },
      { to: '/merchant/inventory/units', labelKey: 'invNavUnits' },
    ],
  },
  {
    titleKey: 'invNavGroupReports',
    items: [
      { to: '/merchant/inventory/report', labelKey: 'invNavReport' },
      { to: '/merchant/inventory/consumption', labelKey: 'invNavConsumption' },
    ],
  },
];

export default function InventoryLayout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { licensed, loading } = useInventoryLicense();

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.to !== '/merchant/inventory/cookbook' &&
            item.to !== '/merchant/inventory/consumption'
        ),
      })),
    []
  );

  if (loading && licensed === null) {
    return <div className="py-12 text-center text-sm muted">{t('loading')}</div>;
  }
  if (licensed === false) return <InventoryUpsell />;

  const current = groups.flatMap((g) => g.items).find((i) => pathname === i.to);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="page-title">{t('invTitle')}</h1>
        <p className="page-sub">{current ? t(current.labelKey) : t('invHint')}</p>
      </div>

      <div className="space-y-2 lg:hidden">
        {groups.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide muted">{t(group.titleKey)}</p>
            <div className="flex flex-wrap gap-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-2.5 py-1.5 text-xs font-medium ${
                      isActive ? 'bg-teal-700 text-white' : 'bg-[var(--bg-muted)]'
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
