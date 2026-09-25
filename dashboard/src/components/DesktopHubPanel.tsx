import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Clock,
  LayoutGrid,
  Package,
  Settings,
  ShoppingCart,
  Store,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  DESKTOP_HUB_NAV,
  isDesktopHubNavActive,
  normalizeDesktopPath,
} from '@/lib/desktop-hub';

const HUB_ICONS = {
  pos: ShoppingCart,
  products: Package,
  categories: LayoutGrid,
  reports: BarChart3,
  store: Store,
  timings: Clock,
  settings: Settings,
} as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DesktopHubPanel({ open, onClose }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const path = normalizeDesktopPath(location.pathname);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const activeItem = DESKTOP_HUB_NAV.find((item) => isDesktopHubNavActive(path, item.path));

  return createPortal(
    <div className="desktop-hub-panel-root fixed inset-0 z-[205] flex flex-col pt-[calc(2.5rem+env(safe-area-inset-top,0px))]">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/40 p-0"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div
        className="desktop-hub-panel relative mx-auto flex h-[min(32rem,calc(100dvh-3rem-env(safe-area-inset-top,0px)))] w-[min(42rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
        role="dialog"
        aria-modal="true"
        aria-label={t('desktopHubNavLabel')}
      >
        <div className="flex min-h-0 w-full">
          <aside className="flex w-52 shrink-0 flex-col border-r border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-950/40">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-3 dark:border-stone-700">
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('desktopHubNavLabel')}</p>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/80 dark:text-stone-400 dark:hover:bg-stone-800"
                onClick={onClose}
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {DESKTOP_HUB_NAV.map((item) => {
                const Icon = HUB_ICONS[item.id];
                const active = isDesktopHubNavActive(path, item.path);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      active
                        ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100'
                        : 'text-stone-700 hover:bg-white hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100'
                    }`}
                    onClick={() => {
                      onClose();
                      navigate(item.path);
                    }}
                  >
                    <Icon size={16} aria-hidden className="shrink-0" />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </nav>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col justify-center px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              RebornPOS
            </p>
            <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
              {activeItem ? t(activeItem.labelKey) : t('desktopHubNavLabel')}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-stone-600 dark:text-stone-400">
              {t('desktopHubPanelHint')}
            </p>
          </main>
        </div>
      </div>
    </div>,
    document.body
  );
}
