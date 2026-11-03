import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ymdZurich } from '@/components/shop/InlineReservationsWidget';
import { useI18n } from '@/lib/i18n';
import type { ReservationSlot } from '@/lib/use-shop-reservations-booking';
import ReservationPromoIcon from '@/components/shop/ReservationPromoIcon';
import { useShopReservationsBooking } from '@/lib/use-shop-reservations-booking';
import '@/styles/delicate-reservations.css';

type BookingSeed = {
  partySize?: number;
  date?: string;
  time?: string;
};

type Props = {
  shopKey: string;
  theme?: 'light' | 'dark';
  accent?: string;
  title?: string;
  showClose?: boolean;
  onClose?: () => void;
  onSuccess?: (payload: { code: string; status: string }) => void;
  /** Applied once config loads (e.g. from scroll peek bar). */
  seed?: BookingSeed | null;
};

function monthDays(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const days: Date[] = [];
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= count; d += 1) {
    days.push(new Date(Date.UTC(year, month, d)));
  }
  return { first, days };
}

const PARTY_CHIP_MAX = 4;
const INITIAL_TIME_SLOTS = 9;

function CalendarIcon() {
  return (
    <svg className="rb-date-other-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm13 8H4v10h16V10ZM6 6h12v2H6V6Z"
      />
    </svg>
  );
}

export default function DelicateReservationsForm({
  shopKey,
  theme = 'light',
  accent,
  title,
  showClose,
  onClose,
  onSuccess,
  seed,
}: Props) {
  const { t, locale, formatDateTime } = useI18n();
  const booking = useShopReservationsBooking(shopKey, t);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarViewYm, setCalendarViewYm] = useState(() => booking.date);
  const [largePartyOpen, setLargePartyOpen] = useState(false);
  const [timeExpanded, setTimeExpanded] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const seedAppliedRef = useRef(false);
  useEffect(() => {
    if (!booking.config || !seed || seedAppliedRef.current) return;
    seedAppliedRef.current = true;
    if (seed.partySize != null) booking.setPartySize(seed.partySize);
    if (seed.date) booking.setDate(seed.date);
    if (seed.time) booking.setTime(seed.time);
  }, [booking.config, seed]);

  useEffect(() => {
    if (calendarOpen) setCalendarViewYm(booking.date);
  }, [calendarOpen, booking.date]);

  useEffect(() => {
    setTimeExpanded(false);
  }, [booking.date, booking.partySize]);

  const rootStyle = accent ? ({ ['--rb-accent' as string]: accent } as CSSProperties) : undefined;
  const heading = title || t('shopReservations');

  const carouselValues = useMemo(
    () => new Set(booking.dateOptions.map((d) => d.value)),
    [booking.dateOptions],
  );
  const isOtherDate = calendarOpen || !carouselValues.has(booking.date);

  const calendarMonth = useMemo(() => {
    const [y, m] = calendarViewYm.split('-').map(Number);
    return monthDays(y, m - 1);
  }, [calendarViewYm]);

  const shiftCalendarMonth = (delta: number) => {
    const [y, m] = calendarViewYm.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
    setCalendarViewYm(next);
  };

  const pickPartyChip = (n: number) => {
    setLargePartyOpen(false);
    booking.setPartySize(n);
  };

  const openLargeParty = () => {
    setLargePartyOpen(true);
    if (booking.partySize <= PARTY_CHIP_MAX) {
      booking.setPartySize(Math.min(booking.maxParty, Math.max(5, booking.minParty)));
    }
  };

  const showLargePartyStepper =
    largePartyOpen || booking.partySize > PARTY_CHIP_MAX || booking.minParty > PARTY_CHIP_MAX;

  const calendarMonthLabel = useMemo(() => {
    const [y, m] = calendarViewYm.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    const loc = locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH';
    return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(d);
  }, [calendarViewYm, locale]);

  const calendarWeekdays = useMemo(() => {
    const loc = locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH';
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(
        new Date(Date.UTC(2024, 0, 1 + i)),
      ),
    );
  }, [locale]);

  const visibleSlots = timeExpanded ? booking.slots : booking.slots.slice(0, INITIAL_TIME_SLOTS);
  const hasMoreTimes = booking.slots.length > INITIAL_TIME_SLOTS;

  const largePartyMessage = useMemo(() => {
    if (!booking.partyGate.blocked) return null;
    if (booking.partyGate.reason === 'call_threshold' && booking.largePartyCallThreshold) {
      return t('shopReservationsLargePartyCall', {
        count: booking.largePartyCallThreshold,
        phone: booking.reservationPhone || '—',
      });
    }
    if (booking.partyGate.reason === 'above_max') {
      return t('shopReservationsLargePartyMax', {
        max: booking.maxParty,
        phone: booking.reservationPhone || '—',
      });
    }
    return null;
  }, [booking, t]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const guestName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    booking.setGuestName(guestName);
    const result = await booking.submit({ guestName });
    if (result) onSuccess?.({ code: result.code, status: result.status });
  };

  const renderSlotButton = (s: ReservationSlot) => {
    const waitlist = !s.available && !!s.waitlistAvailable;
    const canPick = s.available || waitlist;
    const promoLabel =
      s.discountLabel ||
      (s.discountPercent && s.discountPercent > 0 ? `-${s.discountPercent}%` : null);
    return (
      <button
        key={s.time}
        type="button"
        className={['rb-time-btn', waitlist ? 'rb-time-btn--waitlist' : ''].filter(Boolean).join(' ')}
        aria-pressed={booking.time === s.time}
        disabled={!canPick}
        onClick={() => booking.setTime(s.time)}
      >
        <span className="rb-time-btn-main">{s.time}</span>
        {promoLabel ? (
          <span className="rb-time-discount inline-flex items-center gap-0.5">
            <ReservationPromoIcon kind={s.promoIcon || 'percent'} className="h-3 w-3" />
            <span>{promoLabel}</span>
          </span>
        ) : null}
      </button>
    );
  };

  if (booking.loading) {
    return (
      <div className={`rb-root rb-theme-${theme}`} style={rootStyle}>
        <div className="rb-shell">
          <p className="rb-subtitle">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (booking.done) {
    return (
      <div className={`rb-root rb-theme-${theme}`} style={rootStyle}>
        <div className="rb-shell rb-success">
          <h2>{t('shopReservationsThanks')}</h2>
          <p className="rb-subtitle">
            {booking.done.status === 'waitlist'
              ? t('shopReservationsWaitlistDone')
              : booking.done.status === 'confirmed'
                ? t('shopReservationsConfirmedMsg')
                : t('shopReservationsPendingMsg')}
          </p>
          <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem' }}>{booking.done.code}</p>
          <p className="rb-subtitle">{formatDateTime(booking.done.reservedAt)}</p>
        </div>
      </div>
    );
  }

  if (!booking.config && booking.error) {
    return (
      <div className={`rb-root rb-theme-${theme}`} style={rootStyle}>
        <div className="rb-shell">
          <p className="rb-subtitle">{booking.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rb-root rb-theme-${theme}`} style={rootStyle}>
      <form className="rb-shell" onSubmit={onSubmit}>
        <div className="rb-header">
          <div>
            <h1 className="rb-title">{heading}</h1>
            <p className="rb-subtitle">{booking.config?.shopName || ''}</p>
          </div>
          {showClose ? (
            <button type="button" className="rb-close" onClick={onClose} aria-label={t('close')}>
              ×
            </button>
          ) : null}
        </div>

        {booking.error ? <div className="rb-error">{booking.error}</div> : null}

        <div className="rb-section">
          <span className="rb-label">{t('shopReservationsParty')}</span>
          <div className="rb-party-chips" role="group" aria-label={t('shopReservationsParty')}>
            {Array.from({ length: PARTY_CHIP_MAX }, (_, i) => i + 1).map((n) => {
              const disabled = n < booking.minParty || n > booking.maxParty;
              const pressed = !showLargePartyStepper && booking.partySize === n;
              return (
                <button
                  key={n}
                  type="button"
                  className="rb-party-chip"
                  aria-pressed={pressed}
                  disabled={disabled}
                  onClick={() => pickPartyChip(n)}
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              className="rb-party-chip"
              aria-pressed={showLargePartyStepper}
              disabled={booking.maxParty <= PARTY_CHIP_MAX}
              onClick={openLargeParty}
            >
              {booking.partySize > PARTY_CHIP_MAX && showLargePartyStepper ? booking.partySize : '5+'}
            </button>
          </div>
          {showLargePartyStepper ? (
            <div className="rb-stepper rb-stepper--compact">
              <button
                type="button"
                aria-label="-"
                onClick={() => booking.setPartySize(Math.max(booking.minParty, booking.partySize - 1))}
              >
                −
              </button>
              <span>{booking.partySize}</span>
              <button
                type="button"
                aria-label="+"
                onClick={() => booking.setPartySize(Math.min(booking.maxParty, booking.partySize + 1))}
              >
                +
              </button>
            </div>
          ) : null}
          {largePartyMessage ? <p className="rb-callout">{largePartyMessage}</p> : null}
        </div>

        <div className="rb-section">
          <span className="rb-label">{t('shopReservationsDate')}</span>
          <div className="rb-dates" role="group" aria-label={t('shopReservationsDate')}>
            {booking.dateOptions.map((d) => (
              <button
                key={d.value}
                type="button"
                className="rb-date-chip"
                aria-pressed={!isOtherDate && booking.date === d.value}
                onClick={() => {
                  booking.setDate(d.value);
                  setCalendarOpen(false);
                }}
              >
                <span>{d.isToday ? t('shopReservationsToday') : d.weekday}</span>
                <strong>{d.dayNum}</strong>
                <em className="rb-date-month">{d.month}</em>
              </button>
            ))}
            <button
              type="button"
              className="rb-date-chip rb-date-chip--other"
              aria-pressed={isOtherDate}
              aria-expanded={calendarOpen}
              aria-label={t('shopReservationsOtherDate')}
              onClick={() => setCalendarOpen((open) => !open)}
            >
              <CalendarIcon />
              <span className="rb-date-other-label">{t('shopReservationsOtherShort')}…</span>
            </button>
          </div>
          {calendarOpen ? (
            <>
              <label className="rb-date-native-wrap">
                <span className="rb-label rb-label--inline">{t('shopReservationsOtherDate')}</span>
                <input
                  type="date"
                  className="rb-input rb-input--date"
                  value={booking.date}
                  min={ymdZurich()}
                  max={booking.maxDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) booking.setDate(v);
                  }}
                />
              </label>
              <div className="rb-calendar-panel" role="region" aria-label={t('shopReservationsDate')}>
                <div className="rb-calendar-nav">
                  <button type="button" className="rb-calendar-nav-btn" onClick={() => shiftCalendarMonth(-1)}>
                    ‹
                  </button>
                  <span className="rb-calendar-month">{calendarMonthLabel}</span>
                  <button type="button" className="rb-calendar-nav-btn" onClick={() => shiftCalendarMonth(1)}>
                    ›
                  </button>
                </div>
                <div className="rb-calendar-weekdays" aria-hidden>
                  {calendarWeekdays.map((d, i) => (
                    <span key={`${d}-${i}`}>{d}</span>
                  ))}
                </div>
                <div className="rb-calendar-grid">
                  {Array.from({ length: (calendarMonth.first.getUTCDay() + 6) % 7 }).map((_, i) => (
                    <span key={`pad-${i}`} className="rb-calendar-pad" />
                  ))}
                  {calendarMonth.days.map((dt) => {
                    const value = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
                    const disabled = value < ymdZurich() || value > booking.maxDate;
                    return (
                      <button
                        key={value}
                        type="button"
                        className="rb-calendar-day"
                        aria-pressed={booking.date === value}
                        disabled={disabled}
                        onClick={() => {
                          booking.setDate(value);
                          setCalendarOpen(false);
                        }}
                      >
                        {dt.getUTCDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="rb-section">
          <span className="rb-label">{t('shopReservationsTime')}</span>
          {booking.slotsLoading ? (
            <p className="rb-subtitle">{t('loading')}</p>
          ) : booking.partyGate.blocked ? (
            <p className="rb-subtitle">{largePartyMessage}</p>
          ) : booking.slots.length === 0 ? (
            <p className="rb-subtitle">{t('shopReservationsNoSlots')}</p>
          ) : (
            <>
              <div className="rb-time-grid rb-time-grid--standalone">
                {visibleSlots.map(renderSlotButton)}
              </div>
              {hasMoreTimes ? (
                <button
                  type="button"
                  className="rb-show-more"
                  onClick={() => setTimeExpanded((v) => !v)}
                >
                  {timeExpanded ? t('shopReservationsShowLess') : t('shopReservationsShowMore')}
                </button>
              ) : null}
            </>
          )}
          <div className="rb-footer-hints">
            <p className="rb-hint">
              {t('shopReservationsSlotHint', {
                interval: booking.slotIntervalMinutes,
                hours: booking.minHoursBefore,
              })}
            </p>
            {booking.waitlistEnabled ? (
              <p className="rb-hint rb-hint--waitlist">{t('shopReservationsWaitlistHint')}</p>
            ) : null}
          </div>
        </div>

        <div className="rb-row-2 rb-section">
          <label>
            <span className="rb-label">Prénom</span>
            <input
              className="rb-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jean"
              required
            />
          </label>
          <label>
            <span className="rb-label">Nom</span>
            <input
              className="rb-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Dupont"
              required
            />
          </label>
        </div>

        <div className="rb-section">
          <label>
            <span className="rb-label">Email</span>
            <input
              type="email"
              className="rb-input"
              value={booking.guestEmail}
              onChange={(e) => booking.setGuestEmail(e.target.value)}
              placeholder="jean.dupont@email.ch"
            />
          </label>
        </div>

        <div className="rb-section">
          <label>
            <span className="rb-label">{t('phone')}</span>
            <input
              className="rb-input"
              value={booking.guestPhone}
              onChange={(e) => booking.setGuestPhone(e.target.value)}
              placeholder="+41 76 123 45 67"
              required
            />
          </label>
        </div>

        <label className="rb-check rb-section">
          <input
            type="checkbox"
            checked={booking.marketingOptIn}
            onChange={(e) => booking.setMarketingOptIn(e.target.checked)}
          />
          <span>Je souhaite rester informé</span>
        </label>

        {booking.config?.settings?.depositEnabled ? (
          <label className="rb-check rb-section">
            <input
              type="checkbox"
              checked={booking.policyAccepted}
              onChange={(e) => booking.setPolicyAccepted(e.target.checked)}
              required
            />
            <span>{t('shopPolicyAccept')}</span>
          </label>
        ) : null}

        <button type="submit" className="rb-submit" disabled={!booking.canSubmit || booking.submitting}>
          {booking.submitting ? t('saving') : t('shopReservationsBook')}
        </button>

        <p className="rb-powered">Powered by Reborn</p>
      </form>
    </div>
  );
}
