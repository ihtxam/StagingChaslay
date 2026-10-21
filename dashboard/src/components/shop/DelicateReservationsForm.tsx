import { FormEvent, useMemo, useState, type CSSProperties } from 'react';
import { ymdZurich } from '@/components/shop/InlineReservationsWidget';
import { useI18n } from '@/lib/i18n';
import { useShopReservationsBooking } from '@/lib/use-shop-reservations-booking';
import '@/styles/delicate-reservations.css';

type Props = {
  shopKey: string;
  theme?: 'light' | 'dark';
  accent?: string;
  title?: string;
  showClose?: boolean;
  onClose?: () => void;
  onSuccess?: (payload: { code: string; status: string }) => void;
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

export default function DelicateReservationsForm({
  shopKey,
  theme = 'light',
  accent,
  title,
  showClose,
  onClose,
  onSuccess,
}: Props) {
  const { t, formatDateTime } = useI18n();
  const booking = useShopReservationsBooking(shopKey, t);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const rootStyle = accent ? ({ ['--rb-accent' as string]: accent } as CSSProperties) : undefined;
  const heading = title || t('shopReservations');

  const calendarMonth = useMemo(() => {
    const [y, m] = booking.date.split('-').map(Number);
    return monthDays(y, m - 1);
  }, [booking.date]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const guestName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    booking.setGuestName(guestName);
    const result = await booking.submit({ guestName });
    if (result) onSuccess?.({ code: result.code, status: result.status });
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

  const renderTimeGroup = (label: string, list: typeof booking.slots) => {
    if (!list.length) return null;
    return (
      <div>
        <div className="rb-time-group-title">{label}</div>
        <div className="rb-time-grid">
          {list.map((s) => {
            const waitlist = !s.available && !!s.waitlistAvailable;
            const canPick = s.available || waitlist;
            return (
              <button
                key={s.time}
                type="button"
                className="rb-time-btn"
                aria-pressed={booking.time === s.time}
                disabled={!canPick}
                onClick={() => booking.setTime(s.time)}
              >
                {s.time}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

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
          <span className="rb-label">{t('shopReservationsDate')}</span>
          <div className="rb-dates" role="group" aria-label={t('shopReservationsDate')}>
            {booking.dateOptions.map((d) => (
              <button
                key={d.value}
                type="button"
                className="rb-date-chip"
                aria-pressed={booking.date === d.value}
                onClick={() => booking.setDate(d.value)}
              >
                <span>{d.isToday ? t('shopReservationsToday') : d.weekday}</span>
                <strong>{d.dayNum}</strong>
              </button>
            ))}
            <button
              type="button"
              className="rb-date-chip"
              aria-pressed={false}
              onClick={() => setCalendarOpen(true)}
            >
              <span>+</span>
              <strong>···</strong>
            </button>
          </div>
        </div>

        <div className="rb-row-2 rb-section">
          <div>
            <span className="rb-label">{t('shopReservationsParty')}</span>
            <div className="rb-stepper">
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
          </div>
          <div>
            <span className="rb-label">{t('shopReservationsTime')}</span>
            {booking.slotsLoading ? (
              <p className="rb-subtitle">{t('loading')}</p>
            ) : booking.slots.length === 0 ? (
              <p className="rb-subtitle">{t('shopReservationsNoSlots')}</p>
            ) : (
              <div className="rb-time-groups">
                {renderTimeGroup('Midi', booking.lunchSlots)}
                {renderTimeGroup('Soir', booking.dinnerSlots)}
              </div>
            )}
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
          {booking.submitting ? t('saving') : 'Confirmer la réservation'}
        </button>

        <p className="rb-powered">Powered by Reborn</p>
      </form>

      {calendarOpen ? (
        <div className="rb-calendar-backdrop" role="presentation" onClick={() => setCalendarOpen(false)}>
          <div className="rb-calendar" role="dialog" onClick={(e) => e.stopPropagation()}>
            <p className="rb-label">Choisir une date</p>
            <p className="rb-subtitle" style={{ marginBottom: '0.75rem' }}>
              Faites défiler — jusqu&apos;à {booking.config?.settings?.maxDaysAhead || 90} jours à l&apos;avance
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
              {calendarMonth.days.map((dt) => {
                const value = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
                const disabled = value < ymdZurich() || value > booking.maxDate;
                return (
                  <button
                    key={value}
                    type="button"
                    className="rb-time-btn"
                    aria-pressed={booking.date === value}
                    disabled={value > booking.maxDate}
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
        </div>
      ) : null}
    </div>
  );
}
