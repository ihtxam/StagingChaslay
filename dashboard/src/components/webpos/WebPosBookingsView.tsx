import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import ReservationCancelModal from '@/components/reservations/ReservationCancelModal';
import {
  addDaysYmdZurich,
  reservationFormParts,
  ymdZurich,
  zurichDayEndFromYmd,
  zurichDayStartFromYmd,
} from '@/lib/date-format';

type Reservation = {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  partySize: number;
  reservedAt: string;
  status: string;
  tableId: string | null;
  tableLabel: string | null;
  notes: string | null;
};

type Table = { id: string; label: string; capacity: number; status: string };

const emptyForm = () => ({
  guestName: '',
  guestPhone: '',
  guestEmail: '',
  partySize: 2,
  date: ymdZurich(),
  time: '19:00',
  notes: '',
  status: 'confirmed',
  source: 'pos',
});

export default function WebPosBookingsView() {
  const { t, formatDate, formatTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [scope, setScope] = useState<'today' | 'future'>('today');
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [autoAccept, setAutoAccept] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    date: ymdZurich(),
    time: '19:00',
    notes: '',
    tableId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await api.get('/merchant/reservations/config');
      setEnabled(!!cfg.data.config?.enabled);
      const ahead = Number(cfg.data.config?.settings?.maxDaysAhead) || 30;
      setMaxDaysAhead(ahead);
      setAutoAccept(!!cfg.data.config?.settings?.autoAccept);
      setTables(cfg.data.tables || []);

      const today = ymdZurich();
      const from =
        scope === 'today'
          ? zurichDayStartFromYmd(today)
          : zurichDayStartFromYmd(addDaysYmdZurich(1));
      const to =
        scope === 'today'
          ? zurichDayEndFromYmd(today)
          : zurichDayEndFromYmd(addDaysYmdZurich(ahead));

      const res = await api.get('/merchant/reservations', {
        params: { from: from.toISOString(), to: to.toISOString(), status: 'all' },
      });
      setReservations(res.data.reservations || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [scope, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.status === 'pending').length,
    [reservations]
  );

  const editing = useMemo(
    () => reservations.find((r) => r.id === editId) || null,
    [editId, reservations]
  );

  const openEdit = (r: Reservation) => {
    const { date, time } = reservationFormParts(r.reservedAt);
    setEditForm({
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail || '',
      partySize: r.partySize,
      date,
      time,
      notes: r.notes || '',
      tableId: r.tableId || '',
    });
    setEditId(r.id);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      await api.put(`/merchant/reservations/${editId}`, {
        ...editForm,
        tableId: editForm.tableId || null,
        partySize: Number(editForm.partySize),
      });
      toast.success(t('saved'));
      setEditId(null);
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const runAction = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await api.post(`/merchant/reservations/${id}/action`, { action, ...extra });
      toast.success(t('saved'));
      setCancelOpen(null);
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const submitCancel = async (cancelReason: string) => {
    if (!cancelOpen) return;
    await runAction(cancelOpen, 'cancel', {
      cancelReason,
      sendRejectionEmail: true,
    });
  };

  const createReservation = async (e: FormEvent) => {
    e.preventDefault();
    if (!enabled) {
      toast.error(t('reservationsDisabledHint'));
      return;
    }
    setCreateBusy(true);
    try {
      await api.post('/merchant/reservations', {
        ...form,
        partySize: Number(form.partySize),
        source: form.source || 'pos',
        status: form.status || 'confirmed',
        skipSlotCheck: true,
      });
      toast.success(t('created'));
      setCreateOpen(false);
      setForm(emptyForm());
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setCreateBusy(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-900',
      confirmed: 'bg-emerald-100 text-emerald-900',
      seated: 'bg-blue-100 text-blue-900',
      completed: 'bg-stone-100 text-stone-600',
      cancelled: 'bg-stone-100 text-stone-500',
      rejected: 'bg-red-100 text-red-800',
      no_show: 'bg-red-50 text-red-700',
    };
    return colors[status] || 'bg-stone-100 text-stone-700';
  };

  const pendingActions = (r: Reservation, compact = false) => {
    if (r.status !== 'pending') return null;
    return (
      <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : ''}`}>
        <button
          type="button"
          className={`webpos-accent-btn rounded-lg font-semibold ${compact ? 'flex-1 px-3 py-2 text-sm' : 'w-full px-4 py-2.5 text-sm'}`}
          onClick={() => void runAction(r.id, 'accept')}
        >
          {t('reservationsAccept')}
        </button>
        <button
          type="button"
          className={`rounded-lg border border-red-200 bg-red-50 font-semibold text-red-800 hover:bg-red-100 ${compact ? 'flex-1 px-3 py-2 text-sm' : 'w-full px-4 py-2 text-sm'}`}
          onClick={() => void runAction(r.id, 'reject')}
        >
          {t('reservationsReject')}
        </button>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            scope === 'today'
              ? 'bg-[var(--webpos-accent)] text-white'
              : 'bg-stone-100 text-stone-600'
          }`}
          onClick={() => setScope('today')}
        >
          {t('reservationsToday')}
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            scope === 'future'
              ? 'bg-[var(--webpos-accent)] text-white'
              : 'bg-stone-100 text-stone-600'
          }`}
          onClick={() => setScope('future')}
        >
          {t('reservationsFuture')}
        </button>
        {!autoAccept && pendingCount > 0 ? (
          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            {t('reservationsPendingCount').replace('{n}', String(pendingCount))}
          </span>
        ) : null}
        <button
          type="button"
          className="webpos-accent-btn ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          disabled={!enabled}
          onClick={() => {
            if (!enabled) {
              toast.error(t('reservationsDisabledHint'));
              return;
            }
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('reservationsNew')}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => void load()}>
          {t('refresh')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 pb-24">
        {loading ? (
          <p className="text-sm text-stone-500">{t('loading')}</p>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-stone-500">
            {scope === 'today' ? t('reservationsEmpty') : t('reservationsEmptyFuture')}
          </p>
        ) : scope === 'future' ? (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2">{t('date')}</th>
                  <th className="px-3 py-2">{t('time')}</th>
                  <th className="px-3 py-2">{t('name')}</th>
                  <th className="px-3 py-2">{t('reservationsGuests')}</th>
                  <th className="px-3 py-2">{t('reservationsTable')}</th>
                  <th className="px-3 py-2">{t('status')}</th>
                  <th className="px-3 py-2">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const dt = new Date(r.reservedAt);
                  return (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(dt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatTime(dt)}</td>
                      <td className="px-3 py-2 font-medium">{r.guestName}</td>
                      <td className="px-3 py-2">{r.partySize}</td>
                      <td className="px-3 py-2">{r.tableLabel || t('reservationsNoTable')}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-[8rem] flex-col gap-2">
                          {r.status === 'pending' ? pendingActions(r, true) : null}
                          <div className="flex flex-wrap gap-1">
                            {!['cancelled', 'rejected', 'completed', 'no_show'].includes(r.status) ? (
                              <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => openEdit(r)}>
                                {t('edit')}
                              </button>
                            ) : null}
                            {['pending', 'confirmed'].includes(r.status) ? (
                              <button type="button" className="text-xs font-semibold text-red-700" onClick={() => setCancelOpen(r.id)}>
                                {t('cancel')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-3">
            {reservations.map((r) => (
              <li key={r.id} className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.guestName}</p>
                      <p className="text-xs text-stone-500">
                        {formatTime(r.reservedAt)} · {r.partySize} {t('reservationsGuests')}
                      </p>
                      <p className="text-xs text-stone-500">{r.guestPhone}</p>
                      {r.guestEmail ? <p className="text-xs text-stone-400">{r.guestEmail}</p> : null}
                    </div>
                    <div className="text-right text-xs">
                      <p className={`inline-block rounded px-2 py-0.5 font-semibold uppercase ${statusBadge(r.status)}`}>
                        {r.status}
                      </p>
                      <p className="mt-1 text-stone-500">{r.tableLabel || t('reservationsNoTable')}</p>
                      <p className="text-stone-400">{r.code}</p>
                    </div>
                  </div>
                  {r.notes ? <p className="mt-2 text-xs text-stone-600">{r.notes}</p> : null}
                  {!['cancelled', 'rejected', 'completed', 'no_show'].includes(r.status) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => openEdit(r)}>
                        {t('edit')}
                      </button>
                      {['pending', 'confirmed'].includes(r.status) ? (
                        <button type="button" className="text-xs font-semibold text-red-700" onClick={() => setCancelOpen(r.id)}>
                          {t('cancel')}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {r.status === 'pending' ? (
                  <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                    {pendingActions(r)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={createReservation}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-4 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{t('reservationsNew')}</h3>
            <input
              className="input w-full"
              required
              placeholder={t('name')}
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            />
            <input
              className="input w-full"
              required
              placeholder={t('phone')}
              value={form.guestPhone}
              onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
            />
            <input
              className="input w-full"
              type="email"
              placeholder={`${t('email')} (${t('optional')})`}
              value={form.guestEmail}
              onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
            />
            <input
              className="input w-full"
              type="number"
              min={1}
              placeholder={t('reservationsGuests')}
              value={form.partySize}
              onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs block">
                {t('date')}
                <input
                  className="input mt-1 w-full"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="text-xs block">
                {t('time')}
                <input
                  className="input mt-1 w-full"
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
            </div>
            <textarea
              className="input min-h-20 w-full"
              placeholder={t('notes')}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs block">
                <span className="mb-1 block text-stone-500">{t('reservationsStatus')}</span>
                <select
                  className="input w-full"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="confirmed">{t('reservationsConfirmed')}</option>
                  <option value="pending">{t('reservationsPending')}</option>
                </select>
              </label>
              <label className="text-xs block">
                <span className="mb-1 block text-stone-500">{t('reservationsSource')}</span>
                <select
                  className="input w-full"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  <option value="pos">{t('settingsPos')}</option>
                  <option value="phone">{t('reservationsSourcePhone')}</option>
                  <option value="walk_in">{t('reservationsSourceWalkIn')}</option>
                  <option value="online">{t('reservationsSourceOnline')}</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-stone-500">{t('reservationsSendConfirmEmail')}</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)} disabled={createBusy}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={createBusy}>
                {t('create')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editId && editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-4 shadow-xl space-y-3"
          >
            <h3 className="text-lg font-semibold">{t('reservationsEdit')}</h3>
            <input className="input" required value={editForm.guestName} onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })} placeholder={t('name')} />
            <input className="input" required value={editForm.guestPhone} onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })} placeholder={t('phone')} />
            <input className="input" type="email" value={editForm.guestEmail} onChange={(e) => setEditForm({ ...editForm, guestEmail: e.target.value })} placeholder={t('email')} />
            <input className="input" type="number" min={1} value={editForm.partySize} onChange={(e) => setEditForm({ ...editForm, partySize: Number(e.target.value) })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              <input className="input" type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} />
            </div>
            <select className="input" value={editForm.tableId} onChange={(e) => setEditForm({ ...editForm, tableId: e.target.value })}>
              <option value="">{t('reservationsNoTable')}</option>
              {tables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.label} ({tb.capacity})
                </option>
              ))}
            </select>
            <textarea className="input min-h-20" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder={t('notes')} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditId(null)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary">
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ReservationCancelModal
        open={!!cancelOpen}
        variant="webpos"
        onClose={() => setCancelOpen(null)}
        onConfirm={(reason) => void submitCancel(reason)}
      />
    </div>
  );
}
