import { FormEvent, useMemo, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

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

function ymd(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function addDaysYmd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function nextThursdayYmd() {
  const d = new Date();
  const day = d.getDay();
  const add = day <= 4 ? 4 - day : 7 - day + 4;
  d.setDate(d.getDate() + (add || 7));
  return ymd(d);
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

export default function ReservationCreateSheet({ open, tables, onClose, onSubmit }: Props) {
  const { t, formatDate } = useI18n();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ReservationCreateForm>({
    guestLastName: '',
    guestFirstName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    date: ymd(),
    time: '20:00',
    notes: '',
    tableId: '',
    status: 'confirmed',
    source: 'phone',
  });

  const timeSlots = useMemo(() => buildTimeSlots('20:00', 4), []);
  const dateLabel = useMemo(() => {
    try {
      return formatDate(new Date(`${form.date}T12:00:00`));
    } catch {
      return form.date;
    }
  }, [form.date, formatDate]);

  const isPast = useMemo(() => {
    const dt = new Date(`${form.date}T${form.time}:00`);
    return dt.getTime() < Date.now();
  }, [form.date, form.time]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      setForm({
        guestLastName: '',
        guestFirstName: '',
        guestPhone: '',
        guestEmail: '',
        partySize: 2,
        date: ymd(),
        time: '20:00',
        notes: '',
        tableId: '',
        status: 'confirmed',
        source: 'phone',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <button type="button" className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-muted)]" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">{t('reservationsCreateTitle')}</h2>
        <button
          type="submit"
          form="reservation-create-form"
          disabled={saving}
          className="text-sm font-semibold text-rose-600 disabled:opacity-50"
        >
          OK
        </button>
      </header>

      <form id="reservation-create-form" onSubmit={submit} className="flex-1 overflow-y-auto">
        <section className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => {
              const el = document.getElementById('res-date-input') as HTMLInputElement | null;
              el?.showPicker?.();
              el?.focus();
            }}
          >
            <span className="font-medium">{dateLabel}</span>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <input
            id="res-date-input"
            type="date"
            className="sr-only"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {[
              [ymd(), t('reportsToday')],
              [addDaysYmd(1), t('reservationsTomorrow')],
              [nextThursdayYmd(), t('reservationsThisThursday')],
            ].map(([d, label]) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm({ ...form, date: d })}
                className={`rounded-full px-3 py-1.5 text-sm border ${
                  form.date === d
                    ? 'bg-sky-100 border-sky-300 text-sky-900 font-medium'
                    : 'border-[var(--border)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="border-b border-[var(--border)] bg-[var(--bg-elevated)] mt-2">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => {
              const el = document.getElementById('res-time-input') as HTMLInputElement | null;
              el?.showPicker?.();
              el?.focus();
            }}
          >
            <span className="text-sm muted">{t('reservationsTime') || 'Time'}</span>
            <span className="font-medium">{form.time}</span>
          </button>
          <input
            id="res-time-input"
            type="time"
            className="sr-only"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setForm({ ...form, time: slot })}
                className={`rounded-full px-3 py-1.5 text-sm border ${
                  form.time === slot
                    ? 'bg-sky-100 border-sky-300 text-sky-900 font-medium'
                    : 'border-[var(--border)]'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
          {isPast ? (
            <p className="px-4 pb-3 text-xs text-amber-700">{t('reservationsDatePast')}</p>
          ) : null}
        </section>

        <section className="border-b border-[var(--border)] bg-[var(--bg-elevated)] mt-2 px-4 py-3">
          <p className="text-sm muted mb-2">{t('reservationsPartySize')}</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, partySize: n })}
                className={`w-11 h-11 rounded-lg border text-sm font-medium ${
                  form.partySize === n
                    ? 'bg-sky-100 border-sky-300 text-sky-900'
                    : 'border-[var(--border)]'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, partySize: Math.min(20, form.partySize + 1) })}
              className="w-11 h-11 rounded-lg border border-[var(--border)] text-lg"
            >
              +
            </button>
          </div>
        </section>

        <section className="mt-2 bg-[var(--bg-elevated)] border-y border-[var(--border)]">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t('reservationsContactInfo')}
          </p>
          <label className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <span className="w-24 text-sm shrink-0">{t('reservationsLastName')}</span>
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              value={form.guestLastName}
              onChange={(e) => setForm({ ...form, guestLastName: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <span className="w-24 text-sm shrink-0">{t('reservationsFirstName')}</span>
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              value={form.guestFirstName}
              onChange={(e) => setForm({ ...form, guestFirstName: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <span className="w-24 text-sm shrink-0">{t('reservationsPhone')}</span>
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              type="tel"
              value={form.guestPhone}
              onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-3 px-4 py-3">
            <span className="w-24 text-sm shrink-0">{t('email')}</span>
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              type="email"
              value={form.guestEmail}
              onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
            />
          </label>
        </section>

        <section className="mt-2 bg-[var(--bg-elevated)] border-y border-[var(--border)]">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t('reservationsDetails')}
          </p>
          <label className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm">{t('reservationsStatus')}</span>
            <select
              className="text-sm bg-transparent outline-none text-right"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="confirmed">{t('reservationsConfirmed')}</option>
              <option value="pending">{t('reservationsPending')}</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm">{t('reservationsSource')}</span>
            <select
              className="text-sm bg-transparent outline-none text-right"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="phone">{t('reservationsSourcePhone')}</option>
              <option value="walk_in">{t('reservationsSourceWalkIn')}</option>
              <option value="online">{t('reservationsSourceOnline')}</option>
            </select>
          </label>
          {tables.length ? (
            <label className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
              <span className="text-sm">{t('reservationsTable')}</span>
              <select
                className="text-sm bg-transparent outline-none text-right max-w-[50%]"
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
          <label className="flex items-center gap-3 px-4 py-3">
            <span className="w-24 text-sm shrink-0">{t('reservationsComment')}</span>
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </section>
      </form>
    </div>
  );
}
