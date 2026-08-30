import { useEffect, useState } from 'react';
import { ArrowLeft, Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AcceptingMenu from '@/components/AcceptingMenu';
import { usePlatformMessagesUi } from '@/components/platform/PlatformMessagesProvider';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';

interface MerchantCompactStatusRowProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  registerDisplay?: { name: string; roleLabel: string };
}

/**
 * Slim merchant context chips: impersonation, store name, shift + shop status.
 * Rendered in the shell top bar, not under page titles.
 */
export default function MerchantCompactStatusRow({
  onMenuClick,
  showMenuButton = false,
  registerDisplay,
}: MerchantCompactStatusRowProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const impersonating = useAuthStore((s) => s.impersonating);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const platformUi = usePlatformMessagesUi();
  const { theme, toggleTheme } = useTheme();

  const [shiftsEnabled, setShiftsEnabled] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/merchant/settings');
        if (cancelled) return;
        const s = res.data?.settings || {};
        const editionFeats = s.editionFeatures as string[] | undefined;
        const shiftsAllowed =
          editionFeats == null || editionFeats.includes('pos_shifts');
        const on = shiftsAllowed && !!s.shiftsEnabled;
        setShiftsEnabled(on);
        if (on) {
          try {
            const shiftRes = await api.get('/merchant/pos/shifts/current');
            if (!cancelled) setShiftOpen(!!shiftRes.data?.shift?.id);
          } catch {
            if (!cancelled) setShiftOpen(false);
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const backToSuperadmin = () => {
    if (!stopImpersonation()) {
      toast.error('Superadmin session expired — please sign in again');
      navigate('/login');
      return;
    }
    toast.success('Back to Superadmin');
    navigate('/superadmin/merchants');
  };

  const hardRefresh = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <div className="flex min-w-0 items-center justify-end gap-2 text-xs text-[var(--text-muted)]">
      {showMenuButton && onMenuClick ? (
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden inline-flex items-center justify-center rounded-md p-1 hover:bg-[var(--bg-muted)] shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={hardRefresh}
        className="inline-flex items-center justify-center rounded-md p-1 hover:bg-[var(--bg-muted)] shrink-0"
        aria-label={t('panelHardRefresh')}
        title={t('panelHardRefresh')}
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex items-center justify-center rounded-md p-1 hover:bg-[var(--bg-muted)] shrink-0"
        aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>

      {impersonating ? (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
          <span className="truncate">
            {t('viewingAsMerchant')}{' '}
            <span className="font-semibold">{user?.name}</span>
          </span>
          <button
            type="button"
            onClick={backToSuperadmin}
            className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-medium hover:bg-amber-200/80 dark:hover:bg-amber-900/60"
            title={t('backToSuperadmin')}
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden sm:inline">{t('backToSuperadmin')}</span>
          </button>
        </span>
      ) : registerDisplay?.name || user?.name ? (
        <span className="font-medium text-[var(--text)] truncate max-w-[12rem] sm:max-w-none">
          {registerDisplay?.name || user?.name}
        </span>
      ) : null}

      {!statusLoading && shiftsEnabled ? (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${
            shiftOpen
              ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              shiftOpen ? 'bg-teal-500' : 'bg-amber-500'
            }`}
          />
          {shiftOpen ? t('webPosShiftOpenBadge') : t('webPosShiftClosedBadge')}
        </span>
      ) : null}

      {platformUi?.Bell ? (() => {
        const BellSlot = platformUi.Bell;
        return <BellSlot />;
      })() : null}

      <AcceptingMenu />
    </div>
  );
}
