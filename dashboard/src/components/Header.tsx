import { Menu, Bell, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { displaySidebarShopName } from '@/lib/brand';
import type { PanelLocationHeaderLabels } from '@/lib/panel-location-header';
import PanelLocationTitle from '@/components/PanelLocationTitle';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { pinGateSessionMerchantName } from '@/lib/webpos-pin-gate-brand';
import AcceptingMenu from '@/components/AcceptingMenu';
import { OnScreenKeyboardToggle } from '@/components/OnScreenKeyboardToggle';
import { LocationSwitcherChip } from '@/components/merchant/LocationPicker';
import MerchantCompactStatusRow from '@/components/merchant/MerchantCompactStatusRow';
import { usePlatformMessagesUi } from '@/components/platform/PlatformMessagesProvider';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  /** Show Accepting orders/reservations dropdown (merchant panel only) */
  showAcceptingMenu?: boolean;
  /** Slim dedicated top bar: merchant name, shift, shop open — no page title */
  compact?: boolean;
  /** Active register user (PIN session when clocked in, else JWT account). */
  registerDisplay?: { name: string; roleLabel: string };
  /** Store name from settings (`name` / businessName). Shown next to the hamburger. */
  storeName?: string | null;
  /** Multi-location: branch name / HQ badge overrides plain store name. */
  panelLocationLabels?: PanelLocationHeaderLabels | null;
}

export default function Header({
  title,
  onMenuClick,
  showAcceptingMenu = false,
  compact = false,
  registerDisplay,
  storeName,
  panelLocationLabels,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, impersonating, stopImpersonation } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const platformUi = usePlatformMessagesUi();
  const rawStoreName = (storeName || pinGateSessionMerchantName(user)).trim();
  const storeLabel = rawStoreName ? displaySidebarShopName(rawStoreName) : '';
  const locationChrome = panelLocationLabels?.primary ? panelLocationLabels : null;

  const backToSuperadmin = () => {
    if (!stopImpersonation()) {
      toast.error('Superadmin session expired - please sign in again');
      navigate('/login');
      return;
    }
    toast.success('Back to Superadmin');
    navigate('/superadmin/merchants');
  };

  if (compact) {
    return (
      <header className="panel-header shrink-0">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-2 py-1.5 sm:px-4 sm:py-2 min-h-11">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-0.5 rounded-md hover:bg-[var(--bg-muted)] shrink-0 row-span-2 self-center sm:row-span-1"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {locationChrome ? (
            <div className="min-w-0 col-start-2 row-start-1 sm:max-w-none">
              <PanelLocationTitle labels={locationChrome} variant="compact" />
            </div>
          ) : storeLabel ? (
            <span
              className="min-w-0 col-start-2 row-start-1 truncate text-sm font-semibold text-[var(--text)]"
              title={storeLabel}
            >
              {storeLabel}
            </span>
          ) : null}
          <div
            className="col-start-2 row-start-2 flex min-w-0 items-center gap-1 sm:col-start-3 sm:row-start-1 sm:justify-end sm:row-span-1"
          >
            <LocationSwitcherChip />
            <OnScreenKeyboardToggle className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-muted)] data-[active=true]:border-teal-400 data-[active=true]:bg-teal-50 dark:data-[active=true]:bg-teal-950/40" />
            <MerchantCompactStatusRow
              registerDisplay={registerDisplay}
              showAcceptingMenu={showAcceptingMenu}
              mobileDense
            />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="panel-header shrink-0">
      <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md hover:bg-[var(--bg-muted)] shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            {locationChrome ? (
              <PanelLocationTitle labels={locationChrome} variant="compact" />
            ) : storeLabel ? (
              <p className="text-[11px] font-semibold truncate text-[var(--text)]" title={storeLabel}>
                {storeLabel}
              </p>
            ) : null}
            <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
            {impersonating ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-200 truncate">
                {t('viewingAsMerchant')}{' '}
                <span className="font-semibold">{user?.name}</span>
                {' · '}
                <button
                  type="button"
                  onClick={backToSuperadmin}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  {t('backToSuperadmin')}
                </button>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <LocationSwitcherChip />
          {showAcceptingMenu ? <AcceptingMenu /> : null}

          <OnScreenKeyboardToggle className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-muted)] data-[active=true]:border-teal-400 data-[active=true]:bg-teal-50 dark:data-[active=true]:bg-teal-950/40" />

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {platformUi?.Bell ? (() => {
            const BellSlot = platformUi.Bell;
            return <BellSlot />;
          })() : (
            <button type="button" className="relative p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex">
              <Bell className="w-4 h-4 muted" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
