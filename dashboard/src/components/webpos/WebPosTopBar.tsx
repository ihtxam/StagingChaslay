import {
  Bell,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  RefreshCw,
  Search,
  UserCircle2,
  Vault,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { webPosVersionLabel } from '@/lib/app-version';
import type { PosTab, PosView } from './types';

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
  staffName?: string | null;
  canDrawer: boolean;
  appMode: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
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
  staffName,
  canDrawer,
  appMode,
  settingsOpen,
  onToggleSettings,
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
    <header className="relative z-20 shrink-0 border-b border-stone-200 bg-white">
      <div className="flex items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
        {/* Mobile: icon nav (Odoo-style). Desktop: text tabs. */}
        <nav
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:items-end md:gap-1"
          aria-label="POS views"
        >
          {tabs.map((tab) => {
            const active = !inCheckout && activeTab === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                disabled={inCheckout}
                title={tab.label}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50 md:h-auto md:w-auto md:items-end md:rounded-none md:px-3 md:pb-2 md:pt-1 md:text-sm md:font-semibold md:ring-0 ${
                  active
                    ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)] md:border-b-2 md:border-[var(--webpos-accent)] md:bg-transparent md:ring-0'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800 md:border-b-2 md:border-transparent md:hover:bg-transparent'
                }`}
              >
                <Icon size={20} className="md:hidden" aria-hidden />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}

          {!inCheckout && activeTab === 'register' ? (
            <span className="webpos-accent-chip mb-0 ml-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide md:mb-1">
              {t('webPosDirectSale')}
            </span>
          ) : null}
          {tableBadge ? (
            <span className="mb-0 ml-1 shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200 md:mb-1">
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
                onClick={() => setMobileSearchOpen((v) => !v)}
              >
                {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
            </>
          ) : null}

          {/* Desktop / tablet: shift + tools visible. Mobile: overflow into hamburger. */}
          {shiftsEnabled ? (
            <button
              type="button"
              className={`hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold md:inline-flex ${
                shiftOpen
                  ? 'bg-[var(--webpos-accent)] text-white hover:opacity-90'
                  : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
              onClick={() => (shiftOpen ? onCloseShift?.() : onStartShift?.())}
              title={shiftOpen ? t('webPosShiftClose') : t('webPosShiftStart')}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  shiftOpen ? 'bg-white' : 'bg-amber-500'
                }`}
              />
              <span className="hidden sm:inline">
                {shiftOpen ? t('webPosShiftClose') : t('webPosShiftStart')}
              </span>
              <span className="sm:hidden">
                {shiftOpen ? t('webPosShiftOpenBadge') : t('webPosShiftMenu')}
              </span>
            </button>
          ) : showEodButton ? (
            <button
              type="button"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-bold text-stone-800 hover:bg-stone-50 md:inline-flex"
              onClick={() => onEodReport?.()}
              title={t('webPosEodReport')}
            >
              <span className="hidden sm:inline">{t('webPosEodReport')}</span>
              <span className="sm:hidden">{t('webPosEodShort')}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="relative hidden h-9 w-9 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 md:inline-flex"
            onClick={onOnlineOrders}
            title={t('webPosOnlineOrders')}
          >
            <Bell size={17} />
            {onlinePendingCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {onlinePendingCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="hidden h-9 max-w-[7rem] items-center gap-1 truncate rounded-lg border border-stone-200 px-2 text-xs font-medium md:inline-flex"
            onClick={onSwitchUser}
            title={staffName || t('webPosSwitchUser')}
          >
            <UserCircle2 size={16} className="shrink-0" />
            <span className="truncate">{staffName || t('webPosSwitchUser')}</span>
          </button>

          {canDrawer ? (
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 md:inline-flex"
              onClick={onOpenDrawer}
              title={t('webPosOpenDrawer')}
            >
              <Vault size={17} />
            </button>
          ) : null}

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 md:h-9 md:w-9"
              aria-expanded={settingsOpen}
              aria-label={t('webPosMoreShort')}
              onClick={onToggleSettings}
            >
              <Menu size={18} />
            </button>
            {settingsOpen ? settingsPanel : null}
          </div>

          {appMode ? (
            <button
              type="button"
              className="hidden h-9 items-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-medium hover:bg-stone-50 lg:inline-flex"
              onClick={onShowPanel}
            >
              <PanelLeft size={15} />
              {t('webPosMenus')}
            </button>
          ) : null}
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
              autoFocus
            />
          </label>
        </div>
      ) : null}

      {merchantName ? (
        <p className="hidden px-4 pb-1 text-[10px] text-stone-400 sm:block">
          {merchantName}
          {!agentOk ? ` - ${t('webPosStartPrintAgent')}` : ''}
          {shiftsEnabled && shiftOpen ? ` - ${t('webPosShiftOpenBadge')}` : ''}
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
  showEodButton,
  onEodReport,
  onlinePendingCount = 0,
  onOnlineOrders,
  onSwitchUser,
  staffName,
  canDrawer,
  onOpenDrawer,
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
  showEodButton?: boolean;
  onEodReport?: () => void;
  /** Mobile overflow actions (hidden on desktop top bar). */
  onlinePendingCount?: number;
  onOnlineOrders?: () => void;
  onSwitchUser?: () => void;
  staffName?: string | null;
  canDrawer?: boolean;
  onOpenDrawer?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] space-y-3 rounded-xl border border-stone-200 bg-white p-3 shadow-xl">
      <div className="space-y-1.5 border-b border-stone-100 pb-3 md:hidden">
        {onOnlineOrders ? (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
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
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onSwitchUser}
          >
            <UserCircle2 size={16} />
            <span className="truncate">{staffName || t('webPosSwitchUser')}</span>
          </button>
        ) : null}
        {canDrawer && onOpenDrawer ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onOpenDrawer}
          >
            <Vault size={16} />
            {t('webPosOpenDrawer')}
          </button>
        ) : null}
      </div>

      {shiftsEnabled ? (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('webPosShiftMenu')}
          </p>
          {shiftOpen ? (
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-[var(--webpos-accent)] py-2.5 text-sm font-bold text-white hover:opacity-90"
              onClick={onCloseShift}
            >
              {t('webPosShiftClose')}
            </button>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-[var(--webpos-accent)] py-2.5 text-sm font-bold text-white hover:opacity-90"
              onClick={onStartShift}
            >
              {t('webPosShiftStart')}
            </button>
          )}
          <p className="text-[11px] text-stone-500">
            {shiftOpen ? t('webPosShiftOpenHint') : t('webPosShiftClosedHint')}
          </p>
        </div>
      ) : showEodButton ? (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('webPosEodReport')}
          </p>
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-xl bg-[var(--webpos-accent)] py-2.5 text-sm font-bold text-white hover:opacity-90"
            onClick={onEodReport}
          >
            {t('webPosEodPrint')}
          </button>
          <p className="text-[11px] text-stone-500">{t('webPosEodWhenShiftsOff')}</p>
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        <MoreHorizontal size={14} />
        {t('webPosPrinting')}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-stone-500">{t('webPosPrinter')}</span>
        <select
          className="input w-full text-sm"
          value={printerName}
          onChange={(e) => onPrinterChange(e.target.value)}
          disabled={!agentOk}
        >
          <option value="">{t('webPosDefaultPrinter')}</option>
          {printers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.isDefault ? t('webPosDefaultSuffix') : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="rounded"
          checked={autoPrint}
          onChange={(e) => onAutoPrintChange(e.target.checked)}
        />
        {t('webPosAutoPrint')}
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-stone-500">{t('webPosPostSuccessNav')}</span>
        <select
          className="input w-full text-sm"
          value={postSuccessTarget}
          onChange={(e) => onPostSuccessChange(e.target.value as 'register' | 'tables')}
        >
          <option value="register">{t('webPosTabRegister')}</option>
          <option value="tables">{t('webPosTabTables')}</option>
        </select>
      </label>
      <div className="grid grid-cols-1 gap-1.5">
        <button type="button" className="btn-secondary justify-start text-sm" onClick={onRefreshPrinters}>
          <RefreshCw size={14} />
          {t('webPosRefreshPrinters')}
        </button>
        <button type="button" className="btn-secondary justify-start text-sm" onClick={onReloadCatalog}>
          <RefreshCw size={14} />
          {t('webPosReloadCatalog')}
        </button>
      </div>
      <p className="text-[11px] leading-snug text-stone-500">
        {agentOk ? t('webPosAgentOnline') : t('webPosAgentOffline')}
      </p>
      <p className="border-t border-stone-100 pt-2 text-center text-[11px] text-stone-400">
        {webPosVersionLabel}
      </p>
    </div>
  );
}
