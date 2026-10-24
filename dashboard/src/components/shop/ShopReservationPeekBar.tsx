import { useMemo } from 'react';
import { X } from 'lucide-react';
import ReservationPromoIcon from '@/components/shop/ReservationPromoIcon';
import { useI18n } from '@/lib/i18n';
import { useShopReservationsBooking } from '@/lib/use-shop-reservations-booking';

type Props = {
  shopKey: string;
  accent?: string;
  visible: boolean;
  /** Half-visible dock (scroll reveal) vs fully expanded strip */
  halfPeek: boolean;
  onDismiss: () => void;
  onOpenFull: (seed: { partySize: number; date: string; time: string }) => void;
};

const PEEK_TIME_SLOTS = 5;

export default function ShopReservationPeekBar({
  shopKey,
  accent,
  visible,
  halfPeek,
  onDismiss,
  onOpenFull,
}: Props) {
  const { t } = useI18n();
  const booking = useShopReservationsBooking(shopKey, t);
  const fabBg = accent?.trim() || '#1c3557';

  const todayLabel = useMemo(() => {
    const opt = booking.dateOptions.find((d) => d.value === booking.date);
    if (opt?.isToday) return t('shopReservationsToday');
    if (opt) return `${opt.weekday} ${opt.dayNum}`;
    return t('shopReservationsToday');
  }, [booking.date, booking.dateOptions, t]);

  const timeChoices = useMemo(
    () => booking.slots.filter((s) => s.available || s.waitlistAvailable).slice(0, PEEK_TIME_SLOTS),
    [booking.slots],
  );

  if (!visible || booking.loading || booking.config?.acceptingReservations === false) {
    return null;
  }

  const openFull = () => {
    onOpenFull({
      partySize: booking.partySize,
      date: booking.date,
      time: booking.time,
    });
  };

  return (
    <div
      className={[
        'shop-reservation-peek fixed z-[1199] left-0 right-0 flex justify-center px-3 pointer-events-none',
        halfPeek ? 'shop-reservation-peek--half' : 'shop-reservation-peek--full',
        visible ? 'shop-reservation-peek--visible' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        bottom: 'max(0.35rem, env(safe-area-inset-bottom))',
      }}
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2">
        {booking.peekBanner ? (
          <button
            type="button"
            className="shop-reservation-peek__banner flex items-start gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-left text-xs font-medium leading-snug text-amber-950 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            onClick={openFull}
          >
            <ReservationPromoIcon
              kind={booking.peekBanner.icon}
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200"
            />
            <span>{booking.peekBanner.message}</span>
          </button>
        ) : null}
        <div
          className="shop-reservation-peek__card overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.22)] dark:border-zinc-700 dark:bg-zinc-950"
          role="complementary"
          aria-label={t('shopReservationPeekTitle')}
        >
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={openFull}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: fabBg }}
              aria-hidden
            >
              ✦
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('shopReservationPeekTitle')}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-600 dark:text-stone-400">
                <span>
                  {booking.partySize} {t('shopReservationPeekGuests')}
                </span>
                <span className="text-stone-300 dark:text-zinc-600" aria-hidden>·</span>
                <span>{todayLabel}</span>
              </span>
            </span>
          </button>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800"
            aria-label={t('close')}
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-stone-100 px-3 pb-3 pt-2 dark:border-zinc-800">
          <p className="mb-1.5 px-1 text-[0.65rem] font-medium uppercase tracking-wide text-stone-500">
            {t('shopReservationsTime')}
          </p>
          {booking.slotsLoading ? (
            <p className="px-1 text-xs text-stone-500">{t('loading')}</p>
          ) : timeChoices.length === 0 ? (
            <button
              type="button"
              className="w-full rounded-xl bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-800 dark:bg-zinc-900 dark:text-stone-200"
              onClick={openFull}
            >
              {t('shopReservationPeekChooseTime')}
            </button>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {timeChoices.map((slot) => {
                const selected = booking.time === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    className={[
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      selected
                        ? 'text-white'
                        : 'bg-stone-100 text-stone-800 hover:bg-stone-200 dark:bg-zinc-900 dark:text-stone-100',
                    ].join(' ')}
                    style={selected ? { background: fabBg } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      booking.setTime(slot.time);
                    }}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
            style={{ background: fabBg }}
            onClick={openFull}
          >
            {t('shopReservationPeekContinue')}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
