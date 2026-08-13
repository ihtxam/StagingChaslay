import { ArrowLeft, Menu, Bell, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import AcceptingMenu from '@/components/AcceptingMenu';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  /** Show Accepting orders/reservations dropdown (merchant panel only) */
  showAcceptingMenu?: boolean;
}

export default function Header({
  title,
  onMenuClick,
  showAcceptingMenu = false,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, impersonating, stopImpersonation } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const backToSuperadmin = () => {
    if (!stopImpersonation()) {
      toast.error('Superadmin session expired - please sign in again');
      navigate('/login');
      return;
    }
    toast.success('Back to Superadmin');
    navigate('/superadmin/merchants');
  };

  return (
    <header className="panel-header shrink-0">
      {impersonating && (
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-amber-50 text-amber-950 border-b border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900">
          <p className="text-xs sm:text-sm truncate">
            {t('viewingAsMerchant')} <span className="font-semibold">{user?.name}</span>
          </p>
          <button
            type="button"
            onClick={backToSuperadmin}
            className="inline-flex items-center gap-1 shrink-0 rounded-md bg-amber-900/90 px-2 py-1 text-xs font-medium text-white hover:bg-amber-900 dark:bg-amber-200 dark:text-amber-950"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('backToSuperadmin')}
          </button>
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

          <button type="button" className="relative p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex">
            <Bell className="w-4 h-4 muted" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>
    </header>
  );
}
