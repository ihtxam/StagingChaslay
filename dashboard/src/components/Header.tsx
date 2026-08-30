import { Menu, Bell, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import AcceptingMenu from '@/components/AcceptingMenu';
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
}

export default function Header({
  title,
  onMenuClick,
  showAcceptingMenu = false,
  compact = false,
  registerDisplay,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, impersonating, stopImpersonation } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const platformUi = usePlatformMessagesUi();

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
        <div className="h-10 px-3 sm:px-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1 rounded-md hover:bg-[var(--bg-muted)] shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 flex items-center justify-end">
            <MerchantCompactStatusRow registerDisplay={registerDisplay} />
          </div>
        </div>
      </header>
    );
  }

  const backToSuperadmin = () => {
    if (!stopImpersonation()) {
      toast.error('Superadmin session expired — please sign in again');
      navigate('/login');
      return;
    }
    toast.success('Back to Superadmin');
    navigate('/superadmin/merchants');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
      )}

      <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md hover:bg-[var(--bg-muted)] shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onLanguageChange && (
            <select
              className="input py-1 text-xs w-auto min-w-0"
              value={language || 'en'}
              onChange={(e) => onLanguageChange(e.target.value as Locale)}
              aria-label="Language"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="de">DE</option>
            </select>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-[var(--bg-muted)]"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button type="button" className="relative p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex">
            <Bell className="w-4 h-4 muted" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
            <div className="text-right hidden sm:block max-w-[9rem]">
              <p className="font-medium text-xs truncate">{user?.name}</p>
              <p className="text-[10px] muted capitalize truncate">
                {impersonating ? 'Merchant (SA)' : user?.role}
              </p>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex"
              aria-label="Account"
            >
              <User className="w-4 h-4 muted" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-medium hover:bg-[var(--bg-muted)]"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
