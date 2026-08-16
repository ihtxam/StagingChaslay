import {
  Bell,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  RefreshCw,
  Search,
  Sun,
  UserCircle2,
  Vault,
  X,
  ArrowDownUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { webPosVersionLabel } from '@/lib/app-version';
import { isStandalonePwa } from '@/lib/pwa';
import { isUnsuitableRawPrinter } from '@/lib/print-agent';
import type { PosTab, PosView } from './types';

export type WebPosColorTheme = 'teal' | 'green' | 'blue' | 'violet' | 'mono';
export type WebPosTextSize = 'sm' | 'md' | 'lg' | 'xl';
export type WebPosAppearance = 'light' | 'night';

export const WEBPOS_COLOR_THEMES: WebPosColorTheme[] = [
  'teal',
  'green',
  'blue',
  'violet',
  'mono',
];
export const WEBPOS_TEXT_SIZES: WebPosTextSize[] = ['sm', 'md', 'lg', 'xl'];
export const WEBPOS_FULLSCREEN_KEY = 'webpos_fullscreen';

function persistFullscreenPreference(active: boolean) {
  try {
    localStorage.setItem(WEBPOS_FULLSCREEN_KEY, active ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readWebPosFullscreenPreference(): boolean {
  try {
    return localStorage.getItem(WEBPOS_FULLSCREEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function useFullscreenActive() {
  const [active, setActive] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  );
  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return active;
}

export async function toggleWebPosFullscreen(opts?: { forceEnterApp?: boolean }) {
  try {
    // Menus opens the backend sidebar (exits POS chrome). Fullscreen / maximize
    // must bring POS chrome back — browser FS alone leaves the left bar visible.
    if (opts?.forceEnterApp) {
      window.dispatchEvent(new CustomEvent('webpos:enter-app'));
    }
    if (document.fullscreenElement && !opts?.forceEnterApp) {
      await document.exitFullscreen();
      persistFullscreenPreference(false);
      return;
    }
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        persistFullscreenPreference(true);
      }
    }
  } catch {
    // Browser may block without a user gesture or if not allowed in iframe.
  }
}

let pwaFullscreenGestureBound = false;

/** True when the OS/PWA window is already kiosk-sized (manifest display:fullscreen). */
function isPwaDisplayFullscreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: fullscreen)').matches;
}

function bindPwaFullscreenOnFirstGesture() {
  if (pwaFullscreenGestureBound || document.fullscreenElement) return;
  // Installed PWA with manifest display:fullscreen — Fullscreen API is redundant and
  // a persistent capture listener steals every tap when requestFullscreen keeps failing.
  if (isPwaDisplayFullscreen()) return;
  pwaFullscreenGestureBound = true;

  const cleanup = () => {
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
    pwaFullscreenGestureBound = false;
  };

  /** One-shot: always detach after the first gesture so clicks reach the POS UI. */
  const onGesture = () => {
    cleanup();
    if (document.fullscreenElement) return;
    void toggleWebPosFullscreen({ forceEnterApp: true });
  };

  document.addEventListener('pointerdown', onGesture, { capture: true, once: true });
  document.addEventListener('keydown', onGesture, { capture: true, once: true });
}

async function requestDocumentFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) return true;
  const el = document.documentElement;
  if (!el.requestFullscreen) return false;
  try {
    await el.requestFullscreen();
    return !!document.fullscreenElement;
  } catch {
    return false;
  }
}

/** Enter POS chrome + browser fullscreen when preference allows (kiosk / tablet / PWA). */
export async function enterWebPosFullscreenOnLoad() {
  window.dispatchEvent(new CustomEvent('webpos:enter-app'));
  const isPwa = isStandalonePwa();
  if (!isPwa && !readWebPosFullscreenPreference()) return;
  if (document.fullscreenElement) return;
  // Manifest display:fullscreen already fills the screen — skip Fullscreen API + gesture hook.
  if (isPwa && isPwaDisplayFullscreen()) return;

  const entered = await requestDocumentFullscreen();
  if (entered) {
    persistFullscreenPreference(true);
    return;
  }
  if (isPwa) bindPwaFullscreenOnFirstGesture();
}

type Props = {
  activeTab: PosTab;
  posView: PosView;
  onTabChange: (tab: PosTab) => void;
  merchantName?: string;
  agentOk: boolean;
  search: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  onlinePendingCount: number;
  /** Pulsing ring on bell while unactioned online orders remain */
  orderAlertRing?: boolean;
  reservationPendingCount?: number;
  staffName?: string | null;
  canDrawer: boolean;
  /** Show Menus / Esc exit to backend panel (requires ACCESS_PANEL). */
  canShowPanel?: boolean;
  appMode: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  settingsPanel: React.ReactNode;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  onOnlineOrders: () => void;
  onSwitchUser: () => void;
  onOpenDrawer: () => void;
  onShowPanel: () => void;
  tableBadge?: string | null;
  shiftsEnabled?: boolean;
  shiftOpen?: boolean;
  onCloseShift?: () => void;
  onStartShift?: () => void;
  /** When shifts are off: show EOD for managers with END_OF_DAY / VIEW_REPORTS */
  showEodButton?: boolean;
  onEodReport?: () => void;
  /** Hide Tables tab (retail mode). */
  hideTablesTab?: boolean;
  /** Hide Bookings tab (optional for retail). */
  hideBookingsTab?: boolean;
  colorTheme?: WebPosColorTheme;
  onColorThemeChange?: (theme: WebPosColorTheme) => void;
  appearance?: WebPosAppearance;
  onAppearanceChange?: (appearance: WebPosAppearance) => void;
  textSize?: WebPosTextSize;
  onTextSizeChange?: (size: WebPosTextSize) => void;
  /** Offline sale sync (IndexedDB outbox). */
  syncOnline?: boolean;
  syncPendingCount?: number;
  syncFailedCount?: number;
  syncing?: boolean;
  onSyncNow?: () => void;
};

export default function WebPosTopBar({
  activeTab,
  posView,
  onTabChange,
  merchantName,
  agentOk,
  search,
  onSearchChange,
  showSearch,
  onlinePendingCount,
  orderAlertRing = false,
  reservationPendingCount = 0,
  staffName,
  canDrawer,
  canShowPanel = true,
  appMode,
  settingsOpen,
  onToggleSettings,
  onCloseSettings,
  settingsPanel,
  settingsRef,
  onOnlineOrders,
  onSwitchUser,
  onOpenDrawer,
  onShowPanel,
  tableBadge,
  shiftsEnabled,
  shiftOpen,
  onCloseShift,
  onStartShift,
  showEodButton,
  onEodReport,
  hideTablesTab = false,
  hideBookingsTab = false,
  colorTheme = 'teal',
  onColorThemeChange,
  appearance = 'light',
  onAppearanceChange,
  textSize = 'md',
  onTextSizeChange,
  syncOnline = true,
  syncPendingCount = 0,
  syncFailedCount = 0,
  syncing = false,
  onSyncNow,
}: Props) {
  const { t } = useI18n();
  const inCheckout = posView === 'checkout' || posView === 'success';
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const tabs: Array<{ id: PosTab; label: string; Icon: typeof Pencil }> = [
    ...(!hideTablesTab
      ? [{ id: 'tables' as const, label: t('webPosTabTables'), Icon: LayoutGrid }]
      : []),
    { id: 'register', label: t('webPosTabRegister'), Icon: Pencil },
    { id: 'orders', label: t('webPosTabOrders'), Icon: ClipboardList },
    ...(!hideBookingsTab
      ? [{ id: 'bookings' as const, label: t('webPosTabBookings'), Icon: BookOpen }]
      : []),
  ];

  return (
    <header className="relative z-30 shrink-0 overflow-visible border-b border-stone-200 bg-white">
      <div className="flex items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
        {/* Mobile: icon nav (Odoo-style). Desktop: text tabs. */}
        <nav
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:items-end lg:gap-1"
          aria-label="POS views"
        >
          {tabs.map((tab) => {
            const active = !inCheckout && activeTab === tab.id;
            const Icon = tab.Icon;
            const tabBadge =
              tab.id === 'bookings'
                ? reservationPendingCount
                : tab.id === 'orders'
                  ? onlinePendingCount
                  : 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                disabled={inCheckout}
                title={tab.label}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50 lg:h-auto lg:w-auto lg:items-end lg:rounded-none lg:px-3 lg:pb-2 lg:pt-1 lg:text-sm lg:font-semibold lg:ring-0 ${
                  active
                    ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)] lg:border-b-2 lg:border-[var(--webpos-accent)] lg:bg-transparent lg:ring-0'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800 lg:border-b-2 lg:border-transparent lg:hover:bg-transparent'
                }`}
              >
                <Icon size={20} className="lg:hidden" aria-hidden />
                <span className="hidden lg:inline">{tab.label}</span>
                {tabBadge > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white lg:-right-1 lg:top-0">
                    {tabBadge > 99 ? '99+' : tabBadge}
                  </span>
                ) : null}
              </button>
            );
          })}

          {!inCheckout && activeTab === 'register' ? (
            <span className="webpos-accent-chip mb-0 ml-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide lg:mb-1">
              {t('webPosDirectSale')}
            </span>
          ) : null}
          {tableBadge ? (
            <span className="mb-0 ml-1 shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200 lg:mb-1">
              {tableBadge}
            </span>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {showSearch ? (
            <>
              <label className="relative hidden sm:block">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  className="h-9 w-44 rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-2 text-sm lg:w-52"
                  placeholder={t('webPosSearchProducts')}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 sm:hidden"
                aria-label={t('webPosSearchProducts')}
                aria-expanded={mobileSearchOpen}
                onClick={() => {
                  if (!mobileSearchOpen && settingsOpen) onCloseSettings();
                  setMobileSearchOpen((v) => !v);
                }}
              >
                {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
            </>
          ) : null}

          {/* Desktop / tablet: shift + tools visible. Mobile: overflow into hamburger. */}
          <button
            type="button"
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 lg:h-9 lg:w-9 ${
              orderAlertRing
                ? 'ring-2 ring-red-400 ring-offset-1 animate-pulse'
                : ''
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOnlineOrders();
            }}
            title={t('webPosOnlineOrders')}
            aria-label={t('webPosOnlineOrders')}
          >
            <Bell size={17} />
            {onlinePendingCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {onlinePendingCount > 99 ? '99+' : onlinePendingCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="hidden h-9 max-w-[7rem] items-center gap-1 truncate rounded-lg border border-stone-200 px-2 text-xs font-medium lg:inline-flex"
            onClick={onSwitchUser}
            title={staffName || t('webPosSwitchUser')}
          >
            <UserCircle2 size={16} className="shrink-0" />
            <span className="truncate">{staffName || t('webPosSwitchUser')}</span>
          </button>

          {canDrawer ? (
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 lg:inline-flex"
              onClick={onOpenDrawer}
              title={t('webPosOpenDrawer')}
            >
              <Vault size={17} />
            </button>
          ) : null}

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              className="relative z-[52] inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 lg:h-9 lg:w-9"
              aria-expanded={settingsOpen}
              aria-label={t('webPosMoreShort')}
              onClick={() => {
                setMobileSearchOpen(false);
                onToggleSettings();
              }}
            >
              <Menu size={18} />
            </button>
            {settingsOpen ? (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={t('close')}
                  className="fixed inset-0 z-[48] cursor-default border-0 bg-black/10 p-0"
                  onClick={onCloseSettings}
                />
                <div className="relative z-[50]">{settingsPanel}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {showSearch && mobileSearchOpen ? (
        <div className="border-t border-stone-100 px-2 py-2 sm:hidden">
          <label className="relative block">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-2 text-sm"
              placeholder={t('webPosSearchProducts')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
              inputMode="search"
            />
          </label>
        </div>
      ) : null}

      {merchantName ? (
        <p className="webpos-merchant-subline truncate px-2 pb-1 text-[10px] text-stone-400 sm:px-4">
          <span>{merchantName}</span>
          {!agentOk ? (
            <span className="webpos-merchant-subline__warn">
              {' '}
              - {t('webPosStartPrintAgent')}
            </span>
          ) : null}
          {!syncOnline ? (
            <span className="webpos-merchant-subline__offline">
              {' '}
              - {t('webPosSyncOfflineShort')}
            </span>
          ) : null}
          {syncFailedCount > 0 ? (
            <span className="webpos-merchant-subline__sync-failed">
              {' '}
              - {t('webPosSyncFailed').replace('{n}', String(syncFailedCount))}
            </span>
          ) : syncPendingCount > 0 ? (
            <span className="webpos-merchant-subline__sync-pending">
              {' '}
              - {t('webPosSyncPending').replace('{n}', String(syncPendingCount))}
            </span>
          ) : null}
          {shiftsEnabled && shiftOpen ? (
            <span>
              {' '}
              - {t('webPosShiftOpenBadge')}
            </span>
          ) : null}
        </p>
      ) : null}
    </header>
  );
}

export function WebPosSettingsDropdown({
  printerName,
  printers,
  agentOk,
  autoPrint,
  postSuccessTarget,
  onPrinterChange,
  onAutoPrintChange,
  onPostSuccessChange,
  onRefreshPrinters,
  onReloadCatalog,
  shiftsEnabled,
  shiftOpen,
  onCloseShift,
  onStartShift,
  onCashMovement,
  showEodButton,
  onEodReport,
  onlinePendingCount = 0,
  onOnlineOrders,
  onSwitchUser,
  staffName,
  canDrawer,
  onOpenDrawer,
  canShowPanel,
  appMode = true,
  onShowPanel,
  colorTheme = 'teal',
  onColorThemeChange,
  appearance = 'light',
  onAppearanceChange,
  textSize = 'md',
  onTextSizeChange,
  syncOnline = true,
  syncPendingCount = 0,
  syncFailedCount = 0,
  syncing = false,
  onSyncNow,
}: {
  printerName: string;
  printers: Array<{ name: string; isDefault?: boolean }>;
  agentOk: boolean;
  autoPrint: boolean;
  postSuccessTarget: 'register' | 'tables';
  onPrinterChange: (name: string) => void;
  onAutoPrintChange: (v: boolean) => void;
  onPostSuccessChange: (v: 'register' | 'tables') => void;
  onRefreshPrinters: () => void;
  onReloadCatalog: () => void;
  shiftsEnabled?: boolean;
  shiftOpen?: boolean;
  onCloseShift?: () => void;
  onStartShift?: () => void;
  onCashMovement?: () => void;
  showEodButton?: boolean;
  onEodReport?: () => void;
  /** Mobile overflow actions (hidden on desktop top bar). */
  onlinePendingCount?: number;
  onOnlineOrders?: () => void;
  onSwitchUser?: () => void;
  staffName?: string | null;
  canDrawer?: boolean;
  onOpenDrawer?: () => void;
  canShowPanel?: boolean;
  appMode?: boolean;
  onShowPanel?: () => void;
  colorTheme?: WebPosColorTheme;
  onColorThemeChange?: (theme: WebPosColorTheme) => void;
  appearance?: WebPosAppearance;
  onAppearanceChange?: (appearance: WebPosAppearance) => void;
  textSize?: WebPosTextSize;
  onTextSizeChange?: (size: WebPosTextSize) => void;
  syncOnline?: boolean;
  syncPendingCount?: number;
  syncFailedCount?: number;
  syncing?: boolean;
  onSyncNow?: () => void;
}) {
  const { t } = useI18n();
  const fullscreenActive = useFullscreenActive();
  const syncNeedsAttention = !syncOnline || syncPendingCount > 0 || syncFailedCount > 0;
  const bumpTextSize = (dir: -1 | 1) => {
    if (!onTextSizeChange) return;
    const idx = WEBPOS_TEXT_SIZES.indexOf(textSize);
    const next = WEBPOS_TEXT_SIZES[Math.max(0, Math.min(WEBPOS_TEXT_SIZES.length - 1, idx + dir))];
    if (next) onTextSizeChange(next);
  };
  return (
    <div className="webpos-settings-dropdown absolute right-0 top-[calc(100%+6px)] z-50 flex max-h-[min(70vh,32rem)] w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
      <div className="webpos-settings-dropdown-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
      <div className="space-y-1.5 border-b border-stone-100 pb-3">
        {canShowPanel && onShowPanel ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onShowPanel}
          >
            <PanelLeft size={16} />
            {t('webPosDashboard')}
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            {t('webPosRefreshPage')}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={() => {
              if (!appMode) {
                void toggleWebPosFullscreen({ forceEnterApp: true });
                return;
              }
              void toggleWebPosFullscreen();
            }}
          >
            {!appMode || !fullscreenActive ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            {t('webPosEnterFullscreen')}
          </button>
        </div>
      </div>

      {(onAppearanceChange || onTextSizeChange) && (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          {onAppearanceChange ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                {t('webPosAppearance')}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onAppearanceChange('light')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                    appearance === 'light'
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Sun size={14} />
                  {t('webPosAppearanceLightShort')}
                </button>
                <button
                  type="button"
                  onClick={() => onAppearanceChange('night')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                    appearance === 'night'
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Moon size={14} />
                  {t('webPosAppearanceNightShort')}
                </button>
              </div>
            </div>
          ) : null}
          {onTextSizeChange ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                {t('webPosTextSize')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1 text-xs font-bold"
                  disabled={textSize === 'sm'}
                  onClick={() => bumpTextSize(-1)}
                >
                  A−
                </button>
                <span className="min-w-[2.5rem] text-center text-[11px] font-bold uppercase text-stone-500">
                  {textSize}
                </span>
                <button
                  type="button"
                  className="btn-secondary flex-1 text-xs font-bold"
                  disabled={textSize === 'xl'}
                  onClick={() => bumpTextSize(1)}
                >
                  A+
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div className="space-y-1.5 border-b border-stone-100 pb-3 lg:hidden">
        {onOnlineOrders ? (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onOnlineOrders}
          >
            <span className="inline-flex items-center gap-2">
              <Bell size={16} />
              {t('webPosOnlineOrders')}
            </span>
            {onlinePendingCount > 0 ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {onlinePendingCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {onSwitchUser ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onSwitchUser}
          >
            <UserCircle2 size={16} />
            <span className="truncate">{staffName || t('webPosSwitchUser')}</span>
          </button>
        ) : null}
        {canDrawer && onOpenDrawer ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onOpenDrawer}
          >
            <Vault size={16} />
            {t('webPosOpenDrawer')}
          </button>
        ) : null}
      </div>

      {shiftsEnabled ? (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            {t('webPosShiftMenu')}
          </p>
          {shiftOpen ? (
            <button
              type="button"
              className="webpos-accent-btn webpos-menu-accent-btn flex w-full items-center justify-center rounded-xl py-2 text-xs font-bold"
              onClick={onCloseShift}
            >
              {t('webPosShiftClose')}
            </button>
          ) : (
            <button
              type="button"
              className="webpos-accent-btn webpos-menu-accent-btn flex w-full items-center justify-center rounded-xl py-2 text-xs font-bold"
              onClick={onStartShift}
            >
              {t('webPosShiftStart')}
            </button>
          )}
          {shiftOpen && onCashMovement ? (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              onClick={onCashMovement}
            >
              <ArrowDownUp size={16} />
              {t('webPosCashMovementTitle')}
            </button>
          ) : null}
          <p className="text-[10px] text-stone-500">
            {shiftOpen ? t('webPosShiftOpenHint') : t('webPosShiftClosedHint')}
          </p>
        </div>
      ) : showEodButton ? (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            {t('webPosEodReport')}
          </p>
          <button
            type="button"
            className="webpos-accent-btn webpos-menu-accent-btn flex w-full items-center justify-center rounded-xl py-2 text-xs font-bold"
            onClick={onEodReport}
          >
            {t('webPosEodPrint')}
          </button>
          <p className="text-[10px] text-stone-500">{t('webPosEodWhenShiftsOff')}</p>
        </div>
      ) : null}

      {onSyncNow ? (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            {t('webPosSyncMenu')}
          </p>
          <button
            type="button"
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              !syncOnline
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : syncFailedCount > 0
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : syncPendingCount > 0
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
            onClick={onSyncNow}
            disabled={syncing}
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : undefined} />
            {!syncOnline
              ? t('webPosSyncOfflineShort')
              : syncPendingCount > 0 || syncFailedCount > 0
                ? t('webPosSyncPendingShort').replace(
                    '{n}',
                    String(syncPendingCount + syncFailedCount)
                  )
                : t('webPosSyncOkShort')}
          </button>
          {syncNeedsAttention && syncOnline ? (
            <p className="text-center text-[10px] text-stone-500">
              {syncFailedCount > 0
                ? t('webPosSyncFailed').replace('{n}', String(syncFailedCount))
                : t('webPosSyncPending').replace('{n}', String(syncPendingCount))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        <MoreHorizontal size={14} />
        {t('webPosPrinting')}
      </div>
      <label className="block space-y-1 text-xs">
        <span className="text-[11px] text-stone-500">{t('webPosPrinter')}</span>
        <select
          className="input w-full text-xs"
          value={printerName}
          onChange={(e) => onPrinterChange(e.target.value)}
          disabled={!agentOk}
        >
          <option value="">{t('webPosDefaultPrinter')}</option>
          {printers.map((p) => {
            const bad = isUnsuitableRawPrinter(p.name);
            return (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.isDefault ? t('webPosDefaultSuffix') : ''}
                {bad ? t('webPosPrinterNotThermal') : ''}
              </option>
            );
          })}
        </select>
      </label>
      {printerName && isUnsuitableRawPrinter(printerName) ? (
        <p className="text-[10px] leading-snug text-amber-700">{t('webPosUnsuitablePrinter')}</p>
      ) : null}
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="rounded"
          checked={autoPrint}
          onChange={(e) => onAutoPrintChange(e.target.checked)}
        />
        {t('webPosAutoPrint')}
      </label>
      <label className="block space-y-1 text-xs">
        <span className="text-[11px] text-stone-500">{t('webPosPostSuccessNav')}</span>
        <select
          className="input w-full text-xs"
          value={postSuccessTarget}
          onChange={(e) => onPostSuccessChange(e.target.value as 'register' | 'tables')}
        >
          <option value="register">{t('webPosTabRegister')}</option>
          <option value="tables">{t('webPosTabTables')}</option>
        </select>
      </label>
      <div className="grid grid-cols-1 gap-1.5">
        <button type="button" className="btn-secondary justify-start text-xs" onClick={onRefreshPrinters}>
          <RefreshCw size={14} />
          {t('webPosRefreshPrinters')}
        </button>
        <button type="button" className="btn-secondary justify-start text-xs" onClick={onReloadCatalog}>
          <RefreshCw size={14} />
          {t('webPosReloadCatalog')}
        </button>
      </div>
      <p
        className={`text-[10px] leading-snug text-stone-500 ${agentOk ? 'text-center' : ''}`}
      >
        {agentOk ? t('webPosAgentOnline') : t('webPosAgentOffline')}
      </p>
      <p className="border-t border-stone-100 pt-2 text-center text-[10px] text-stone-400">
        {webPosVersionLabel}
      </p>
      </div>
    </div>
  );
}
