import { Bell, Menu, Plus, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

const PAGE_TITLES: Array<{ test: (path: string) => boolean; key: string }> = [
  { test: (p) => p === '/reseller' || p === '/reseller/', key: 'overview' },
  { test: (p) => p.startsWith('/reseller/merchants'), key: 'agencyMerchantStores' },
  { test: (p) => p.startsWith('/reseller/licenses'), key: 'agencyDeviceLicenses' },
  { test: (p) => p.startsWith('/reseller/editions'), key: 'agencyPosManagement' },
  { test: (p) => p.startsWith('/reseller/packages'), key: 'agencyPackagesAddons' },
  { test: (p) => p.startsWith('/reseller/support'), key: 'supportInboxTitle' },
];

type Props = {
  onMenuClick: () => void;
  onAddStore: () => void;
  notificationCount?: number;
};

export default function AgencyTopBar({ onMenuClick, onAddStore, notificationCount = 0 }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');

  const title = useMemo(() => {
    const match = PAGE_TITLES.find((row) => row.test(location.pathname));
    return match ? t(match.key) : t('overview');
  }, [location.pathname, t]);

  const submitSearch = (ev: FormEvent) => {
    ev.preventDefault();
    const next = q.trim();
    navigate(next ? `/reseller/merchants?q=${encodeURIComponent(next)}` : '/reseller/merchants');
  };

  return (
    <header className="agency-topbar shrink-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden -ml-1 rounded-md p-1.5 text-stone-600 hover:bg-stone-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-stone-900">
          {title}
        </h1>
        <form onSubmit={submitSearch} className="hidden min-w-[220px] max-w-sm flex-1 md:block">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              className="w-full rounded-full border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-rose-300 focus:bg-white"
              placeholder={t('agencySearchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </form>
        <button
          type="button"
          className="relative rounded-full p-2 text-stone-500 hover:bg-stone-100"
          onClick={() => navigate('/reseller/support')}
          aria-label={t('supportInboxTitle')}
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-600" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={onAddStore}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#9f1239] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#861032]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('resellerAddStore')}</span>
        </button>
      </div>
    </header>
  );
}

export function agencyInitials(name: string | undefined | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'AG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
