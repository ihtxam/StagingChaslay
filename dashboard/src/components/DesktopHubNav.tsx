import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import DesktopHubPanel from '@/components/DesktopHubPanel';
import {
  getDesktopHubActiveItem,
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

/** Gear button opens a settings-style hub panel with left navigation. */
export function DesktopHubGearMenu({ className = '' }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const path = normalizeDesktopPath(location.pathname);
  const [open, setOpen] = useState(false);

  if (path === '/login' || path.startsWith('/login')) return null;

  return (
    <>
      <button
        type="button"
        className={`desktop-chrome-btn inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-50/90 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white ${className}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('desktopHubNavLabel')}
        title={t('desktopHubNavLabel')}
        data-active={open ? 'true' : undefined}
      >
        <Settings size={15} aria-hidden />
      </button>
      <DesktopHubPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** @deprecated Use DesktopHubActiveLabel + DesktopHubGearMenu in DesktopChromeBar. */
export default function DesktopHubNav({ className = '' }: Props) {
  return <DesktopHubActiveLabel className={className} />;
}
