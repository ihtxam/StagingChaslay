import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DelicateReservationsForm from '@/components/shop/DelicateReservationsForm';
import { useI18n } from '@/lib/i18n';
import {
  DEFAULT_RESERVATION_AUTO_OPEN_DELAY_MS,
  DEFAULT_RESERVATION_SCROLL_THRESHOLD_PX,
  isReservationScrollAutoOpenSurface,
  useReservationScrollReveal,
} from '@/lib/reservation-scroll-reveal';

type Props = {
  shopKey: string;
  accent?: string;
  /** When false, FAB is visible immediately (legacy). Default: scroll reveal on. */
  scrollReveal?: boolean;
};

/**
 * Floating “Réserver une table” control — same UX as the external embed script, inlined on shop surfaces.
 */
export default function ShopReservationFab({ shopKey, accent, scrollReveal = true }: Props) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const label = t('shopReservations');
  const fabBg = accent?.trim() || '#1c3557';

  const allowAutoOpen = isReservationScrollAutoOpenSurface(pathname);

  const { revealed, pulse, reducedMotion, onUserOpened, onUserClosed } = useReservationScrollReveal({
    enabled: scrollReveal,
    scrollThresholdPx: DEFAULT_RESERVATION_SCROLL_THRESHOLD_PX,
    autoOpenDelayMs: DEFAULT_RESERVATION_AUTO_OPEN_DELAY_MS,
    allowAutoOpen,
    onAutoOpen: () => setOpen(true),
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    onUserClosed();
  }, [onUserClosed]);

  const openDialog = useCallback(() => {
    onUserOpened();
    setOpen(true);
  }, [onUserOpened]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const fabVisible = !scrollReveal || revealed;

  return (
    <>
      <button
        type="button"
        className={[
          'shop-reservation-fab fixed z-[1200] inline-flex max-w-[min(100vw-2rem,20rem)] items-center gap-2.5 rounded-full border-0 px-[1.15rem] py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(15,23,42,0.22)] transition-[transform,opacity,box-shadow] duration-300 hover:-translate-y-px hover:shadow-[0_14px_32px_rgba(15,23,42,0.28)]',
          fabVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
          pulse && !reducedMotion ? 'shop-reservation-fab--pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          right: 'max(1rem, env(safe-area-inset-right))',
          bottom: 'max(1rem, env(safe-area-inset-bottom))',
          background: fabBg,
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-hidden={!fabVisible}
        onClick={openDialog}
      >
        <span
          className="flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center rounded-md bg-white/15 text-xs"
          aria-hidden
        >
          ✦
        </span>
        <span className="truncate">{label}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[1201] flex items-end justify-center bg-slate-900/45 p-0 animate-in fade-in duration-200 sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="w-full max-w-[440px] max-h-[92vh] overflow-hidden rounded-t-2xl bg-transparent animate-in fade-in slide-in-from-bottom-4 duration-300 sm:rounded-2xl sm:slide-in-from-bottom-2 sm:shadow-[0_24px_64px_rgba(15,23,42,0.35)]"
            role="dialog"
            aria-label={label}
          >
            <div className="max-h-[min(92vh,720px)] overflow-y-auto bg-white sm:max-h-[min(88vh,760px)]">
              <DelicateReservationsForm
                shopKey={shopKey}
                theme="light"
                accent={accent}
                showClose
                onClose={close}
                onSuccess={() => {
                  window.setTimeout(close, 2400);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
