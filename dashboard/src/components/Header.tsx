import { Menu, Bell, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import AcceptingMenu from '@/components/AcceptingMenu';
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
      </div>
    </header>
  );
}
