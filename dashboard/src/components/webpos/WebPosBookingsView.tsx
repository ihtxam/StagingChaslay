import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

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

function ymd(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function addDaysYmd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export default function WebPosBookingsView() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [scope, setScope] = useState<'today' | 'future'>('today');
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [editId, setEditId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editForm, setEditForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    date: ymd(),
    time: '19:00',
    notes: '',
    tableId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await api.get('/merchant/reservations/config');
      const ahead = Number(cfg.data.config?.settings?.maxDaysAhead) || 30;
      setMaxDaysAhead(ahead);
      setTables(cfg.data.tables || []);

      const today = ymd();
      const from =
        scope === 'today'
          ? new Date(`${today}T00:00:00`)
          : new Date(`${addDaysYmd(1)}T00:00:00`);
      const to =
        scope === 'today'
          ? new Date(`${today}T23:59:59`)
          : new Date(`${addDaysYmd(ahead)}T23:59:59`);

      const res = await api.get('/merchant/reservations', {
        params: { from: from.toISOString(), to: to.toISOString(), status: 'all' },
      });
      setReservations(res.data.reservations || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [scope, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = useMemo(
    () => reservations.find((r) => r.id === editId) || null,
    [editId, reservations]
  );

  const openEdit = (r: Reservation) => {
    const dt = new Date(r.reservedAt);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
    setEditForm({
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail || '',
      partySize: r.partySize,
      date: local.toISOString().slice(0, 10),
      time: local.toISOString().slice(11, 16),
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
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const runAction = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await api.post(`/merchant/reservations/${id}/action`, { action, ...extra });
      toast.success(t('saved'));
      setCancelOpen(null);
      setCancelReason('');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const submitCancel = async () => {
    if (!cancelOpen) return;
    await runAction(cancelOpen, 'cancel', {
      cancelReason,
      sendRejectionEmail: true,
    });
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
        <button type="button" className="btn-secondary ml-auto text-sm" onClick={() => void load()}>
          {t('refresh')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
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
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dt.toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.guestName}</td>
                      <td className="px-3 py-2">{r.partySize}</td>
                      <td className="px-3 py-2">{r.tableLabel || t('reservationsNoTable')}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {!['cancelled', 'rejected', 'completed', 'no_show'].includes(r.status) ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-indigo-700"
                              onClick={() => openEdit(r)}
                            >
                              {t('edit')}
                            </button>
                          ) : null}
                          {['pending', 'confirmed'].includes(r.status) ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700"
                              onClick={() => setCancelOpen(r.id)}
                            >
                              {t('cancel')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-2">
            {reservations.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.guestName}</p>
                    <p className="text-xs text-stone-500">
                      {new Date(r.reservedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {r.partySize} {t('reservationsGuests')}
                    </p>
                    <p className="text-xs text-stone-500">{r.guestPhone}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={`inline-block rounded px-2 py-0.5 font-semibold uppercase ${statusBadge(r.status)}`}>
                      {r.status}
                    </p>
                    <p className="text-stone-500">{r.tableLabel || t('reservationsNoTable')}</p>
                    <p className="text-stone-400">{r.code}</p>
                    <div className="mt-1 flex justify-end gap-2">
                      {!['cancelled', 'rejected', 'completed', 'no_show'].includes(r.status) ? (
                        <button type="button" className="font-semibold text-indigo-700" onClick={() => openEdit(r)}>
                          {t('edit')}
                        </button>
                      ) : null}
                      {r.status === 'pending' ? (
                        <>
                          <button type="button" className="font-semibold text-emerald-700" onClick={() => void runAction(r.id, 'accept')}>
                            {t('reservationsAccept')}
                          </button>
                          <button type="button" className="font-semibold text-red-700" onClick={() => void runAction(r.id, 'reject')}>
                            {t('reservationsReject')}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editId && editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-4 shadow-xl space-y-3"
          >
            <h3 className="text-lg font-semibold">{t('reservationsEdit')}</h3>
            <input className="input" required value={editForm.guestName} onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })} placeholder={t('name')} />
            <input className="input" required value={editForm.guestPhone} onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })} placeholder={t('phone')} />
            <input className="input" type="email" value={editForm.guestEmail} onChange={(e) => setEditForm({ ...editForm, guestEmail: e.target.value })} placeholder="Email" />
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

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">{t('reservationsCancelTitle')}</h3>
            <p className="text-sm text-stone-600">{t('reservationsCancelHint')}</p>
            <textarea
              className="input min-h-24"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('reservationsCancelReason')}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCancelOpen(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary bg-red-700 hover:bg-red-800" onClick={() => void submitCancel()}>
                {t('reservationsCancelSend')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
