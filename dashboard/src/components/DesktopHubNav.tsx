import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  DESKTOP_HUB_NAV,
  getDesktopHubActiveItem,
  isDesktopHubNavActive,
  normalizeDesktopPath,
} from '@/lib/desktop-hub';

type Props = {
  className?: string;
};

/** Current hub page label for the left side of the desktop chrome bar. */
export function DesktopHubActiveLabel({ className = '' }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const path = normalizeDesktopPath(location.pathname);

  if (path === '/login' || path.startsWith('/login')) return null;

  const active = getDesktopHubActiveItem(path);
  const label = active ? t(active.labelKey) : 'RebornPOS';

  return (
    <span
      className={`mr-auto min-w-0 truncate px-2 text-xs font-semibold uppercase tracking-wide text-slate-200/90 ${className}`}
    >
      {label}
    </span>
  );
}

/** Gear menu with all desktop hub navigation destinations. */
export function DesktopHubGearMenu({ className = '' }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const path = normalizeDesktopPath(location.pathname);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (path === '/login' || path.startsWith('/login')) return null;

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        className="desktop-chrome-btn inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-50/90 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('desktopHubNavLabel')}
        title={t('desktopHubNavLabel')}
        data-active={open ? 'true' : undefined}
      >
        <Settings size={15} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-[210] min-w-[11rem] overflow-hidden rounded-lg border border-black/20 bg-[#1a2428] py-1 shadow-xl"
          role="menu"
          aria-label={t('desktopHubNavLabel')}
        >
          {DESKTOP_HUB_NAV.map((item) => {
            const active = isDesktopHubNavActive(path, item.path);
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`block w-full px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-slate-200/90 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => {
                  setOpen(false);
                  navigate(item.path);
                }}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use DesktopHubActiveLabel + DesktopHubGearMenu in DesktopChromeBar. */
export default function DesktopHubNav({ className = '' }: Props) {
  return <DesktopHubActiveLabel className={className} />;
}
