import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useI18n } from '@/lib/i18n';
import ShopNotAcceptingBanner from '@/components/shop/ShopNotAcceptingBanner';

type Slot = {
  time: string;
  available: boolean;
  remainingCovers: number;
  discountPercent?: number;
  discountLabel?: string | null;
};

/** Calendar date YYYY-MM-DD in Europe/Zurich (matches reservation backend). */
export function ymdZurich(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Current HH:mm in Europe/Zurich */
export function hmZurich(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

type Props = {
  shopKey: string;
  base?: string;
  /** Override heading (CMS block title). */
  title?: string;
  /** Embedded on homepage — tighter layout, no page-level intro duplicate. */
  embedded?: boolean;
};

export default function InlineReservationsWidget({
  shopKey,
  base = '',
  title,
  embedded = false,
}: Props) {
  const { t, locale, formatDateTime } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(() => ymdZurich());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ code: string; status: string; reservedAt: string } | null>(
    null
  );
  const [partyExpanded, setPartyExpanded] = useState(false);
  const [timesExpanded, setTimesExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (partySize > 4) setPartyExpanded(true);
  }, [partySize]);

  useEffect(() => {
    setTimesExpanded(false);
  }, [date, partySize]);

  useEffect(() => {
    if (!time || timesExpanded) return;
    const idx = slots.findIndex((s) => s.time === time);
    if (idx >= 6) setTimesExpanded(true);
  }, [time, slots, timesExpanded]);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/reservations/config`);
        if (cancelled) return;
        setConfig(res.data.config);
        const min = Number(res.data.config?.settings?.minPartySize) || 2;
        setPartySize(min);
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.error || t('shopReservationsUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t]);

  useEffect(() => {
    if (!shopKey || !config) return;
    let cancelled = false;
    setSlotsLoading(true);
    setTime('');
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/reservations/slots`, {
          params: { date, partySize },
        });
        if (cancelled) return;
        setSlots(
          (res.data.slots || []).filter((s: Slot) => {
            if (date !== ymdZurich()) return true;
            const leadH = Number(config?.settings?.minHoursBefore) || 0;
            const nowHm = hmZurich();
            const [nh, nm] = nowHm.split(':').map(Number);
            const nowMins = nh * 60 + nm + Math.max(0, leadH) * 60;
            const [sh, sm] = String(s.time || '00:00').split(':').map(Number);
            return sh * 60 + sm > nowMins;
          })
        );
      } catch (e: any) {
        if (!cancelled) {
          setSlots([]);
          setError(e.response?.data?.error || t('shopReservationsSlotsFailed'));
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, config, date, partySize, t]);

  const maxDate = useMemo(() => {
    const days = Number(config?.settings?.maxDaysAhead) || 30;
    const [y, m, d] = ymdZurich().split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }, [config]);

  const minParty = Number(config?.settings?.minPartySize) || 1;
  const maxParty = Number(config?.settings?.maxPartySize) || 12;

  const partyOptions = useMemo(() => {
    const list: number[] = [];
    for (let n = minParty; n <= maxParty; n += 1) list.push(n);
    return list;
  }, [minParty, maxParty]);

  const dateOptions = useMemo(() => {
    const days = Math.min(Math.max(Number(config?.settings?.maxDaysAhead) || 30, 1), 60);
    const loc = locale === 'fr' || locale === 'de' ? locale : 'en';
    const [y0, m0, d0] = ymdZurich().split('-').map(Number);
    const out: Array<{
      value: string;
      weekday: string;
      dayNum: string;
      month: string;
      isToday: boolean;
    }> = [];
    for (let i = 0; i < days; i += 1) {
      const dt = new Date(Date.UTC(y0, m0 - 1, d0 + i, 12, 0, 0));
      const value = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      const labelDate = new Date(`${value}T12:00:00+02:00`);
      out.push({
        value,
        weekday: labelDate.toLocaleDateString(loc, { weekday: 'short' }),
        dayNum: String(dt.getUTCDate()),
        month: labelDate.toLocaleDateString(loc, { month: 'short' }),
        isToday: i === 0,
      });
    }
    return out;
  }, [config, locale]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (config?.acceptingReservations === false) {
      setError(t('shopNotAcceptingReservations'));
      return;
    }
    if (config?.vacation?.active) {
      setError(t('shopVacationReservationsBlocked'));
      return;
    }
    if (!time) {
      setError(t('shopReservationsPickTime'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post(`/api/shop/${shopKey}/reservations`, {
        guestName,
        guestPhone,
        guestEmail: guestEmail || undefined,
        partySize,
        date,
        time,
        notes: notes || undefined,
      });
      setDone({
        code: res.data.reservation.code,
        status: res.data.reservation.status,
        reservedAt: res.data.reservation.reservedAt,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopReservationsBookFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBtn =
    'border-[var(--shop-accent,#1c1917)] bg-[var(--shop-accent,#1c1917)] text-[var(--shop-accent-text,#fff)]';
  const idleBtn =
    'border-[var(--color-border-default,#d6d3d1)] bg-[var(--color-bg-0,#fff)] text-[var(--color-text-0,#1c1917)] hover:border-[var(--shop-accent,#1c1917)]';

  if (loading) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-2)' }}>
        {t('loading')}
      </p>
    );
  }

  if (!config && error) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-1)' }}>
        {error}
      </p>
    );
  }

  if (done) {
    return (
      <div
        className="rounded-xl border p-6 space-y-3 text-center"
        style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-1)' }}
      >
        <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-0)' }}>
          {t('shopReservationsThanks')}
        </h2>
        <p style={{ color: 'var(--color-text-2)' }}>
          {done.status === 'confirmed'
            ? t('shopReservationsConfirmedMsg')
            : t('shopReservationsPendingMsg')}
        </p>
        <p className="font-mono text-sm">{done.code}</p>
        <p className="text-sm">{formatDateTime(done.reservedAt)}</p>
        {base ? (
          <Link to={`${base}/menu`} className="shop-btn-primary inline-block mt-2 px-5 py-2.5 text-sm font-semibold">
            {t('shopOrder')}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`space-y-5 overflow-x-hidden max-w-full ${embedded ? '' : 'rounded-xl border p-5 md:p-6'}`}
      style={
        embedded
          ? undefined
          : { borderColor: 'var(--color-border-default)', background: 'var(--color-bg-1)' }
      }
    >
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-0)' }}>
            {title || t('shopReservations')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-2)' }}>
            {t('shopReservationsIntro')}
          </p>
          {config?.address ? (
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-2)' }}>
              {config.address}
            </p>
          ) : null}
        </div>
      ) : title ? (
        <h2 className="text-xl font-semibold text-center md:text-left" style={{ color: 'var(--color-text-0)' }}>
          {title}
        </h2>
      ) : null}

      {error ? (
        <div className="text-sm border border-red-200 bg-red-50 text-red-800 px-3 py-2 rounded-lg">{error}</div>
      ) : null}

      {config?.vacation?.active ? (
        <div className="text-sm border border-amber-200 bg-amber-50 text-amber-950 px-3 py-2 rounded-lg">
          {(() => {
            const msg = config.vacation.message;
            if (typeof msg === 'string' && msg.trim()) return msg.trim();
            if (msg && typeof msg === 'object') {
              const loc = (locale === 'fr' || locale === 'de' ? locale : 'en') as 'en' | 'fr' | 'de';
              const picked = msg[loc] || msg.en || msg.fr || msg.de;
              if (picked) return String(picked);
            }
            return t('shopVacationReservationsBlocked');
          })()}
        </div>
      ) : null}

      {config?.acceptingReservations === false ? (
        <ShopNotAcceptingBanner kind="reservations" phone={config?.phone} />
      ) : null}

      <fieldset className="space-y-2 min-w-0">
        <legend className="text-sm font-medium">{t('shopReservationsParty')}</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('shopReservationsParty')}>
          {(partyExpanded ? partyOptions : partyOptions.slice(0, 4)).map((n) => {
            const selected = partySize === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPartySize(n)}
                className={`min-h-11 text-base font-semibold border transition-colors rounded-lg ${
                  selected ? selectedBtn : idleBtn
                }`}
              >
                {n}
              </button>
            );
          })}
          {!partyExpanded && partyOptions.length > 4 ? (
            <button type="button" onClick={() => setPartyExpanded(true)} className={`col-span-4 min-h-11 text-base font-semibold border rounded-lg ${idleBtn}`}>
              {t('shopReservationsShowMore')}
            </button>
          ) : null}
          {partyExpanded && partyOptions.length > 4 ? (
            <button type="button" onClick={() => setPartyExpanded(false)} className={`col-span-4 min-h-11 text-base font-semibold border rounded-lg ${idleBtn}`}>
              {t('shopReservationsShowLess')}
            </button>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-2 min-w-0">
        <legend className="text-sm font-medium">{t('shopReservationsDate')}</legend>
        <div className="max-w-full min-w-0 overflow-x-hidden">
          <div
            className="flex gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory max-w-full [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="radiogroup"
            aria-label={t('shopReservationsDate')}
          >
            {dateOptions.map((d) => {
              const selected = date === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setDate(d.value);
                    setDatePickerOpen(false);
                  }}
                  className={`snap-start shrink-0 w-12 min-h-11 py-1.5 border text-center transition-colors rounded-lg ${
                    selected && !datePickerOpen ? selectedBtn : idleBtn
                  }`}
                >
                  <span className="block text-[9px] font-medium uppercase tracking-wide opacity-80 leading-none">
                    {d.isToday ? t('shopReservationsToday') : d.weekday}
                  </span>
                  <span className="mt-1 block text-sm font-bold leading-none">{d.dayNum}</span>
                  <span className="mt-0.5 block text-[9px] opacity-80 leading-none">{d.month}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDatePickerOpen((v) => !v)}
              className={`snap-start shrink-0 w-12 min-h-11 py-1.5 border text-center transition-colors rounded-lg ${
                datePickerOpen ? selectedBtn : idleBtn
              }`}
              aria-expanded={datePickerOpen}
              title={t('shopReservationsOtherDate')}
            >
              <span className="block text-[9px] font-medium uppercase tracking-wide opacity-80 leading-none">
                {t('shopReservationsOtherShort')}
              </span>
              <span className="mt-1 block text-sm font-bold leading-none">···</span>
            </button>
          </div>
        </div>
        {datePickerOpen ? (
          <input
            type="date"
            className="border px-3 py-2 w-full max-w-[11rem] text-sm rounded-lg"
            style={{ borderColor: 'var(--color-border-default)' }}
            min={ymdZurich()}
            max={maxDate}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        ) : null}
      </fieldset>

      <fieldset className="space-y-2 min-w-0">
        <legend className="text-sm font-medium">{t('shopReservationsTime')}</legend>
        {slotsLoading ? (
          <p className="text-sm py-4" style={{ color: 'var(--color-text-2)' }}>
            {t('loading')}
          </p>
        ) : slots.length === 0 ? (
          <p
            className="text-sm border border-dashed p-4 text-center rounded-lg"
            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-2)' }}
          >
            {t('shopReservationsNoSlots')}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('shopReservationsTime')}>
            {(timesExpanded ? slots : slots.slice(0, 6)).map((s) => {
              const selected = time === s.time;
              return (
                <button
                  key={s.time}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!s.available}
                  onClick={() => setTime(s.time)}
                  className={`min-h-11 px-1 text-sm font-semibold border tabular-nums transition-colors flex flex-col items-center justify-center leading-tight rounded-lg ${
                    selected
                      ? selectedBtn
                      : s.available
                        ? idleBtn
                        : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed line-through'
                  }`}
                >
                  <span>{s.time}</span>
                  {s.discountLabel ? (
                    <span className={`text-[10px] font-bold ${selected ? 'text-amber-200' : 'text-amber-700'}`}>
                      {s.discountLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {!timesExpanded && slots.length > 6 ? (
              <button type="button" onClick={() => setTimesExpanded(true)} className={`col-span-3 min-h-11 text-sm font-semibold border rounded-lg ${idleBtn}`}>
                {t('shopReservationsShowMore')}
              </button>
            ) : null}
            {timesExpanded && slots.length > 6 ? (
              <button type="button" onClick={() => setTimesExpanded(false)} className={`col-span-3 min-h-11 text-sm font-semibold border rounded-lg ${idleBtn}`}>
                {t('shopReservationsShowLess')}
              </button>
            ) : null}
          </div>
        )}
        <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
          {t('shopReservationsSlotHint')
            .replace('{interval}', String(config?.settings?.slotIntervalMinutes || 30))
            .replace('{hours}', String(config?.settings?.minHoursBefore || 0))}
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm block sm:col-span-2">
          <span className="font-medium block mb-1">{t('name')}</span>
          <input
            className="border px-3 py-2 w-full rounded-lg"
            style={{ borderColor: 'var(--color-border-default)' }}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />
        </label>
        <label className="text-sm block">
          <span className="font-medium block mb-1">{t('phone')}</span>
          <input
            className="border px-3 py-2 w-full rounded-lg"
            style={{ borderColor: 'var(--color-border-default)' }}
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            required
          />
        </label>
        <label className="text-sm block">
          <span className="font-medium block mb-1">Email</span>
          <input
            type="email"
            className="border px-3 py-2 w-full rounded-lg"
            style={{ borderColor: 'var(--color-border-default)' }}
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
          />
        </label>
        <label className="text-sm block sm:col-span-2">
          <span className="font-medium block mb-1">{t('notes')}</span>
          <textarea
            className="border px-3 py-2 w-full min-h-20 rounded-lg"
            style={{ borderColor: 'var(--color-border-default)' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      {config?.settings?.policiesText ? (
        <p className="text-xs whitespace-pre-wrap border-t pt-3" style={{ color: 'var(--color-text-2)', borderColor: 'var(--color-border-subtle)' }}>
          {config.settings.policiesText}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !time || config?.acceptingReservations === false || config?.vacation?.active}
        className="shop-btn-primary w-full py-3 font-semibold rounded-lg disabled:opacity-40"
      >
        {submitting ? t('saving') : t('shopReservationsBook')}
      </button>
    </form>
  );
}
