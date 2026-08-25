import { FormEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { addDaysYmdZurich, ymdZurich } from '@/lib/date-format';
import { dayKeyOf, zonedLocalDate, type DayKey } from '@/lib/shop-hours';

const MAX_PHONE_DIGITS = 15;
const MAX_NAME_LENGTH = 20;

function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);
}

const DAY_NUM: Record<DayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

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

function nextThursdayYmd() {
  const today = ymdZurich();
  const [y, m, d] = today.split('-').map(Number);
  const noon = zonedLocalDate(y, m, d, 12, 0);
  const day = DAY_NUM[dayKeyOf(noon)];
  const add = day <= 4 ? 4 - day : 7 - day + 4;
  return addDaysYmdZurich(add || 7, noon);
}

function buildTimeSlots(start = '18:00', count = 8, stepMin = 15) {
  const [h, m] = start.split(':').map(Number);
  const slots: string[] = [];
  let mins = (h || 0) * 60 + (m || 0);
  for (let i = 0; i < count; i++) {
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    mins += stepMin;
  }
  return slots;
}

type Props = {
  open: boolean;
  tables: Table[];
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

const emptyForm = (): ReservationCreateForm => ({
  guestLastName: '',
  guestFirstName: '',
  guestPhone: '',
  guestEmail: '',
  partySize: 2,
  date: ymdZurich(),
  time: '20:00',
  notes: '',
  tableId: '',
  status: 'confirmed',
  source: 'phone',
});

export default function ReservationCreateSheet({ open, tables, onClose, onSubmit }: Props) {
  const { t, formatDate } = useI18n();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<ReservationCreateForm>(emptyForm);

  const timeSlots = useMemo(() => buildTimeSlots('20:00', 4), []);
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
      setForm(emptyForm());
    } catch {
      // Keep entered values when the API rejects the save.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-create-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label={t('cancel')}
        onClick={onClose}
      />

      <div className="relative flex max-h-[min(92vh,640px)] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:max-w-[24rem] sm:rounded-2xl">
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
                  [nextThursdayYmd(), t('reservationsThisThursday')],
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
              <div className="flex flex-wrap gap-1.5">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setForm({ ...form, time: slot })}
                    className={chipClass(form.time === slot)}
                  >
                    {slot}
                  </button>
                ))}
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
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsLastName')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    value={form.guestLastName}
                    maxLength={MAX_NAME_LENGTH}
                    aria-invalid={!!fieldErrors.guestLastName}
                    onChange={(e) => {
                      setForm({ ...form, guestLastName: e.target.value.slice(0, MAX_NAME_LENGTH) });
                      if (fieldErrors.guestLastName) {
                        setFieldErrors((prev) => ({ ...prev, guestLastName: undefined }));
                      }
                    }}
                  />
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {t('maxCharacters').replace('{n}', String(MAX_NAME_LENGTH))}
                  </p>
                  {fieldErrors.guestLastName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.guestLastName}</p>
                  ) : null}
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsFirstName')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    value={form.guestFirstName}
                    maxLength={MAX_NAME_LENGTH}
                    aria-invalid={!!fieldErrors.guestFirstName}
                    onChange={(e) => {
                      setForm({ ...form, guestFirstName: e.target.value.slice(0, MAX_NAME_LENGTH) });
                      if (fieldErrors.guestFirstName) {
                        setFieldErrors((prev) => ({ ...prev, guestFirstName: undefined }));
                      }
                    }}
                  />
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {t('maxCharacters').replace('{n}', String(MAX_NAME_LENGTH))}
                  </p>
                  {fieldErrors.guestFirstName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.guestFirstName}</p>
                  ) : null}
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">{t('reservationsPhone')}</span>
                  <input
                    className="input w-full py-2 text-sm"
                    type="tel"
                    inputMode="numeric"
                    maxLength={MAX_PHONE_DIGITS}
                    value={form.guestPhone}
                    aria-invalid={!!fieldErrors.guestPhone}
                    onChange={(e) => {
                      setForm({ ...form, guestPhone: sanitizePhoneInput(e.target.value) });
                      if (fieldErrors.guestPhone) {
                        setFieldErrors((prev) => ({ ...prev, guestPhone: undefined }));
                      }
                    }}
                  />
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
