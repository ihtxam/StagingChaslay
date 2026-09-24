import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import {
  DESKTOP_HUB_NAV,
  isDesktopHubNavActive,
  normalizeDesktopPath,
} from '@/lib/desktop-hub';

type Props = {
  className?: string;
};

export default function DesktopHubNav({ className = '' }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const path = normalizeDesktopPath(location.pathname);

  if (path === '/login' || path.startsWith('/login')) return null;

  return (
    <nav
      className={`desktop-hub-nav flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 ${className}`}
      aria-label={t('desktopHubNavLabel')}
    >
      {DESKTOP_HUB_NAV.map((item) => {
        const active = isDesktopHubNavActive(path, item.path);
        return (
          <button
            key={item.id}
            type="button"
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              active
                ? 'bg-white/15 text-white'
                : 'text-slate-200/85 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => navigate(item.path)}
          >
            {t(item.labelKey)}
          </button>
        );
      })}
    </nav>
  );
}
