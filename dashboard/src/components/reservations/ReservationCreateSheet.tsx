import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { addDaysYmdZurich, ymdZurich } from '@/lib/date-format';
import { dayKeyOf, zonedLocalDate, type DayKey } from '@/lib/shop-hours';

const MAX_PHONE_DIGITS = 15;
const MAX_NAME_LENGTH = 20;

function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);
}

export type ReservationCreateForm = {
  guestLastName: string;
  guestFirstName: string;
  guestPhone: string;
  guestEmail: string;
  partySize: number;
  date: string;
  time: string;
  notes: string;
  tableId: string;
  status: string;
  source: string;
};

type Table = { id: string; label: string; capacity: number };

type Slot = { time: string; available?: boolean };

type CustomerHit = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  lastPartySize?: number | null;
};

type Props = {
  open: boolean;
  tables: Table[];
  defaultSource?: string;
  onClose: () => void;
  onSubmit: (form: ReservationCreateForm) => Promise<void>;
};

const chipClass = (active: boolean) =>
  `rounded-full px-2.5 py-1 text-xs sm:text-sm border transition ${
    active
      ? 'bg-sky-100 border-sky-300 text-sky-900 font-medium'
      : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
  }`;

type FieldErrors = {
  guestFirstName?: string;
  guestLastName?: string;
  guestPhone?: string;
};

const emptyForm = (source = 'phone'): ReservationCreateForm => ({
  guestLastName: '',
  guestFirstName: '',
  guestPhone: '',
  guestEmail: '',
  partySize: 2,
  date: ymdZurich(),
  time: '19:00',
  notes: '',
  tableId: '',
  status: 'confirmed',
  source,
});

function slotsFromHours(
  hours: Partial<Record<DayKey, Array<{ open: string; close: string }>>> | undefined,
  dateYmd: string,
  interval = 30
): string[] {
  if (!hours) return [];
  const [y, m, d] = dateYmd.split('-').map(Number);
  const day = dayKeyOf(zonedLocalDate(y, m, d, 12, 0));
  const ranges = hours[day] || [];
  const out: string[] = [];
  for (const range of ranges) {
    const [oh, om] = String(range.open || '11:00').split(':').map(Number);
    const [ch, cm] = String(range.close || '22:00').split(':').map(Number);
    let mins = (oh || 0) * 60 + (om || 0);
    const end = (ch || 0) * 60 + (cm || 0);
    const bound = end > mins ? end : mins + 60;
    while (mins + 1 < bound) {
      const hh = Math.floor(mins / 60) % 24;
      const mm = mins % 60;
      out.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      mins += interval;
    }
  }
  return out;
}

function customerLabel(c: CustomerHit) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return [name || null, c.phone || null, c.email || null].filter(Boolean).join(' · ');
}

export default function ReservationCreateSheet({
  open,
  tables,
  defaultSource = 'phone',
  onClose,
  onSubmit,
}: Props) {
  const { t, formatDate } = useI18n();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<ReservationCreateForm>(() => emptyForm(defaultSource));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [hoursSlots, setHoursSlots] = useState<string[]>([]);
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([]);
  const [suggestOpen, setSuggestOpen] = useState<'name' | 'phone' | null>(null);
  const suggestTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultSource));
    setFieldErrors({});
    setCustomerHits([]);
    setSuggestOpen(null);
  }, [open, defaultSource]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.get('/merchant/reservations/config');
        const hours = cfg.data?.config?.hours as
          | Partial<Record<DayKey, Array<{ open: string; close: string }>>>
          | undefined;
        const interval = Number(cfg.data?.config?.settings?.slotIntervalMinutes) || 30;
        if (!cancelled) setHoursSlots(slotsFromHours(hours, form.date, interval));
      } catch {
        if (!cancelled) setHoursSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.date]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/merchant/reservations/slots', {
          params: { date: form.date, partySize: form.partySize },
        });
        if (cancelled) return;
        const next = ((res.data?.slots || []) as Slot[]).filter((s) => s.time);
        setSlots(next);
        if (next.length && !next.some((s) => s.time === form.time)) {
          const firstOk = next.find((s) => s.available !== false) || next[0];
          if (firstOk?.time) setForm((prev) => ({ ...prev, time: firstOk.time }));
        }
      } catch {
        if (!cancelled) setSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.date, form.partySize]);

  const searchCustomers = (q: string, field: 'name' | 'phone') => {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    if (q.trim().length < 2) {
      setCustomerHits([]);
      setSuggestOpen(null);
      return;
    }
    suggestTimer.current = window.setTimeout(() => {
      void api
        .get('/merchant/reservations/customers', { params: { q: q.trim() } })
        .then((res) => {
          setCustomerHits(res.data?.customers || []);
          setSuggestOpen(field);
        })
        .catch(() => {
          setCustomerHits([]);
        });
    }, 220);
  };

  const applyCustomer = (c: CustomerHit) => {
    setForm((prev) => ({
      ...prev,
      guestFirstName: (c.firstName || prev.guestFirstName).slice(0, MAX_NAME_LENGTH),
      guestLastName: (c.lastName || prev.guestLastName).slice(0, MAX_NAME_LENGTH),
      guestPhone: sanitizePhoneInput(c.phone || prev.guestPhone),
      guestEmail: c.email || prev.guestEmail,
      partySize: c.lastPartySize && c.lastPartySize > 0 ? c.lastPartySize : prev.partySize,
    }));
    setSuggestOpen(null);
    setCustomerHits([]);
  };

  const timeChips = useMemo(() => {
    const raw = slots.length ? slots.map((s) => s.time) : hoursSlots;
    if (form.date !== ymdZurich()) return raw;
    const [y, m, d] = form.date.split('-').map(Number);
    const now = Date.now();
    return raw.filter((slot) => {
      const [hh, mm] = slot.split(':').map(Number);
      return zonedLocalDate(y, m, d, hh, mm).getTime() > now;
    });
  }, [slots, hoursSlots, form.date]);

  useEffect(() => {
    if (!timeChips.length) return;
    if (!timeChips.includes(form.time)) {
      setForm((prev) => ({ ...prev, time: timeChips[0] }));
    }
  }, [timeChips, form.time]);

  const dateLabel = useMemo(() => {
    try {
      const [y, m, d] = form.date.split('-').map(Number);
      return formatDate(zonedLocalDate(y, m, d, 12, 0));
    } catch {
      return form.date;
    }
  }, [form.date, formatDate]);

  const isPast = useMemo(() => {
    const [y, m, d] = form.date.split('-').map(Number);
    const [hh, mm] = form.time.split(':').map(Number);
    return zonedLocalDate(y, m, d, hh, mm).getTime() < Date.now();
  }, [form.date, form.time]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!form.guestFirstName.trim()) {
      nextErrors.guestFirstName = t('reservationsFirstNameRequired');
    } else if (form.guestFirstName.length > MAX_NAME_LENGTH) {
      nextErrors.guestFirstName = t('reservationsFirstNameTooLong');
    }
    if (!form.guestLastName.trim()) {
      nextErrors.guestLastName = t('reservationsLastNameRequired');
    } else if (form.guestLastName.length > MAX_NAME_LENGTH) {
      nextErrors.guestLastName = t('reservationsLastNameTooLong');
    }
    const phoneDigits = form.guestPhone.replace(/\D/g, '');
    if (!phoneDigits) {
      nextErrors.guestPhone = t('reservationsPhoneRequired');
    } else if (phoneDigits.length > MAX_PHONE_DIGITS) {
      nextErrors.guestPhone = t('reservationsPhoneTooLong');
    }
    if (nextErrors.guestFirstName || nextErrors.guestLastName || nextErrors.guestPhone) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await onSubmit(form);
      setForm(emptyForm(defaultSource));
    } catch {
      // Keep entered values when the API rejects the save.
    } finally {
      setSaving(false);
    }
  };

  const suggestList = (field: 'name' | 'phone') =>
    suggestOpen === field && customerHits.length ? (
      <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg">
        {customerHits.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-muted)]"
              onMouseDown={(ev) => {
                ev.preventDefault();
                applyCustomer(c);
              }}
            >
              <span className="font-medium">{customerLabel(c)}</span>
              {c.lastPartySize ? (
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  {t('reservationsPartySize')}: {c.lastPartySize}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-create-title"
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />

      <div className="relative flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:max-w-[48rem] sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 id="reservation-create-title" className="text-base font-semibold">
            {t('reservationsCreateTitle')}
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-[var(--bg-muted)]"
            onClick={onClose}
            aria-label={t('cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form id="reservation-create-form" onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {t('date')}
                </p>
                <label className="text-xs text-[var(--text-muted)]">
                  <span className="sr-only">{t('date')}</span>
                  <input
                    type="date"
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-xs"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
              </div>
              <p className="mb-2 text-sm font-medium">{dateLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  [ymdZurich(), t('reportsToday')],
                  [addDaysYmdZurich(1), t('reservationsTomorrow')],
                  [addDaysYmdZurich(2), t('reservationsDayAfterTomorrow')],
                ].map(([d, label]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm({ ...form, date: d })}
                    className={chipClass(form.date === d)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {t('reservationsTime') || t('time')}
                </p>
                <label className="text-xs text-[var(--text-muted)]">
                  <span className="sr-only">{t('time')}</span>
                  <input
                    type="time"
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-xs"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                {timeChips.length ? (
                  timeChips.map((slot) => {
                    const meta = slots.find((s) => s.time === slot);
                    const unavailable = meta?.available === false;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setForm({ ...form, time: slot })}
                        className={`${chipClass(form.time === slot)} ${unavailable ? 'opacity-40' : ''}`}
                      >
                        {slot}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">{t('reservationsNoSlots')}</p>
                )}
              </div>
              {isPast ? (
                <p className="mt-2 text-xs text-amber-700">{t('reservationsDatePast')}</p>
              ) : null}
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('reservationsPartySize')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, partySize: n })}
                    className={`h-9 w-9 rounded-lg border text-sm font-medium ${
                      form.partySize === n
                        ? 'bg-sky-100 border-sky-300 text-sky-900'
                        : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, partySize: Math.min(20, form.partySize + 1) })}
                  className="h-9 w-9 rounded-lg border border-[var(--border)] text-lg hover:bg-[var(--bg-muted)]"
                >
                  +
                </button>
                {form.partySize > 5 ? (
                  <span className="self-center text-sm font-semibold tabular-nums">{form.partySize}</span>
                ) : null}
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('reservationsContactInfo')}
              </p>
              <div className="space-y-2">
                <label className="relative block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsLastName')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    value={form.guestLastName}
                    maxLength={MAX_NAME_LENGTH}
                    autoComplete="off"
                    aria-invalid={!!fieldErrors.guestLastName}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, MAX_NAME_LENGTH);
                      setForm({ ...form, guestLastName: v });
                      searchCustomers(`${form.guestFirstName} ${v}`.trim(), 'name');
                      if (fieldErrors.guestLastName) {
                        setFieldErrors((prev) => ({ ...prev, guestLastName: undefined }));
                      }
                    }}
                    onBlur={() => setTimeout(() => setSuggestOpen((s) => (s === 'name' ? null : s)), 150)}
                  />
                  {suggestList('name')}
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {t('maxCharacters').replace('{n}', String(MAX_NAME_LENGTH))}
                  </p>
                  {fieldErrors.guestLastName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.guestLastName}</p>
                  ) : null}
                </label>
                <label className="relative block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsFirstName')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    value={form.guestFirstName}
                    maxLength={MAX_NAME_LENGTH}
                    autoComplete="off"
                    aria-invalid={!!fieldErrors.guestFirstName}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, MAX_NAME_LENGTH);
                      setForm({ ...form, guestFirstName: v });
                      searchCustomers(`${v} ${form.guestLastName}`.trim(), 'name');
                      if (fieldErrors.guestFirstName) {
                        setFieldErrors((prev) => ({ ...prev, guestFirstName: undefined }));
                      }
                    }}
                    onBlur={() => setTimeout(() => setSuggestOpen((s) => (s === 'name' ? null : s)), 150)}
                  />
                  {suggestList('name')}
                  {fieldErrors.guestFirstName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.guestFirstName}</p>
                  ) : null}
                </label>
                <label className="relative block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsPhone')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    type="tel"
                    inputMode="numeric"
                    maxLength={MAX_PHONE_DIGITS}
                    autoComplete="off"
                    value={form.guestPhone}
                    aria-invalid={!!fieldErrors.guestPhone}
                    onChange={(e) => {
                      const v = sanitizePhoneInput(e.target.value);
                      setForm({ ...form, guestPhone: v });
                      searchCustomers(v, 'phone');
                      if (fieldErrors.guestPhone) {
                        setFieldErrors((prev) => ({ ...prev, guestPhone: undefined }));
                      }
                    }}
                    onBlur={() => setTimeout(() => setSuggestOpen((s) => (s === 'phone' ? null : s)), 150)}
                  />
                  {suggestList('phone')}
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t('customersPhoneHint')}</p>
                  {fieldErrors.guestPhone ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.guestPhone}</p>
                  ) : null}
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('email')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    type="email"
                    value={form.guestEmail}
                    onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                  />
                </label>
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('reservationsDetails')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsStatus')}</span>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="confirmed">{t('reservationsConfirmed')}</option>
                    <option value="pending">{t('reservationsPending')}</option>
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsSource')}</span>
                  <select
                    className="input w-full py-2 text-sm"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  >
                    <option value="pos">{t('settingsPos')}</option>
                    <option value="phone">{t('reservationsSourcePhone')}</option>
                    <option value="walk_in">{t('reservationsSourceWalkIn')}</option>
                    <option value="online">{t('reservationsSourceOnline')}</option>
                  </select>
                </label>
                {tables.length ? (
                  <label className="block text-xs col-span-2">
                    <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsTable')}</span>
                    <select
                      className="input w-full py-2 text-sm"
                      value={form.tableId}
                      onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                    >
                      <option value="">—</option>
                      {tables.map((tbl) => (
                        <option key={tbl.id} value={tbl.id}>
                          {tbl.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block text-xs col-span-2">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsComment')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
              </div>
            </section>
          </div>
        </form>

        <footer className="flex shrink-0 gap-2 border-t border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <button type="button" className="btn-secondary flex-1 py-2 text-sm" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="reservation-create-form"
            disabled={saving}
            className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
          >
            {saving ? t('loading') : t('save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
