import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

const tabs = [
  { path: 'settings', labelKey: 'tableNavSettings' as const },
  { path: 'layout', labelKey: 'tableNavLayout' as const },
  { path: 'qr', labelKey: 'tableNavQr' as const },
];

export default function TableManagementLayout() {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('navTableManagement')}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('tableManagementHint')}</p>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/merchant/tables/${tab.path}`}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`
            }
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
