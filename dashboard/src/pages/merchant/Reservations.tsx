import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import ReservationCancelModal from '@/components/reservations/ReservationCancelModal';

type Reservation = {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  partySize: number;
  reservedAt: string;
  durationMinutes: number;
  status: string;
  tableId: string | null;
  tableLabel: string | null;
  notes: string | null;
  internalNotes: string | null;
  source: string;
  discountPercent?: number | null;
  discountLabel?: string | null;
};

type Table = { id: string; label: string; capacity: number; status: string; floorPlanName?: string };

function ymd(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function addDaysYmd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export default function Reservations() {
  const { t, formatDate, formatDateTime, formatTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [bookingsScope, setBookingsScope] = useState<'today' | 'future'>('today');
  const [dateFilter, setDateFilter] = useState(ymd());
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState<string | null>(null);
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
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    date: ymd(),
    time: '19:00',
    notes: '',
    tableId: '',
  });

  const loadConfig = useCallback(async () => {
    const res = await api.get('/merchant/reservations/config');
    setEnabled(!!res.data.config?.enabled);
    setMaxDaysAhead(res.data.config?.settings?.maxDaysAhead || 30);
    setTables(res.data.tables || []);
  }, []);

  const loadList = useCallback(async () => {
    const today = ymd();
    const from =
      bookingsScope === 'today'
        ? new Date(`${today}T00:00:00`)
        : new Date(`${addDaysYmd(1)}T00:00:00`);
    const to =
      bookingsScope === 'today'
        ? new Date(`${today}T23:59:59`)
        : new Date(`${addDaysYmd(maxDaysAhead)}T23:59:59`);
    const res = await api.get('/merchant/reservations', {
      params: {
        from: from.toISOString(),
        to: to.toISOString(),
        status: statusFilter,
      },
    });
    setReservations(res.data.reservations || []);
  }, [bookingsScope, maxDaysAhead, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadConfig();
      await loadList();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadConfig, loadList, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) void loadList().catch(() => undefined);
  }, [bookingsScope, statusFilter, maxDaysAhead]);

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
      await loadList();
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const submitCancel = async (cancelReason: string) => {
    if (!cancelOpen) return;
    try {
      await api.post(`/merchant/reservations/${cancelOpen}/action`, {
        action: 'cancel',
        cancelReason,
        sendRejectionEmail: true,
      });
      toast.success(t('saved'));
      setCancelOpen(null);
      await loadList();
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const runAction = async (
    id: string,
    action: string,
    extra: Record<string, unknown> = {}
  ) => {
    try {
      await api.post(`/merchant/reservations/${id}/action`, { action, ...extra });
      toast.success(t('saved'));
      await loadList();
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const createReservation = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/merchant/reservations', {
        ...form,
        tableId: form.tableId || undefined,
        partySize: Number(form.partySize),
        source: 'phone',
      });
      setCreateOpen(false);
      setForm({
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        partySize: 2,
        date: dateFilter,
        time: '19:00',
        notes: '',
        tableId: '',
      });
      toast.success(t('created'));
      await loadList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
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

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.status === 'pending').length,
    [reservations]
  );

  if (loading) {
    return <div className="p-4 text-sm muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('reservationsTitle')}</h1>
          <p className="text-sm muted mt-1">{t('reservationsHint')}</p>
        </div>
        {pendingCount > 0 ? (
          <span className="text-sm rounded-lg bg-amber-100 text-amber-900 px-3 py-2">
            {t('reservationsPendingCount').replace('{n}', String(pendingCount))}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
          {!enabled && (
            <p className="text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">
              {t('reservationsDisabledHint')}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${bookingsScope === 'today' ? 'bg-slate-900 text-white' : 'border bg-white'}`}
                onClick={() => setBookingsScope('today')}
              >
                {t('reservationsToday')}
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${bookingsScope === 'future' ? 'bg-slate-900 text-white' : 'border bg-white'}`}
                onClick={() => setBookingsScope('future')}
              >
                {t('reservationsFuture')}
              </button>
            </div>
            <label className="text-sm">
              <span className="muted block mb-1">{t('status')}</span>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{t('all')}</option>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="seated">seated</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
                <option value="rejected">rejected</option>
                <option value="no_show">no_show</option>
              </select>
            </label>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              {t('reservationsNew')}
            </button>
          </div>

          {createOpen && (
            <form
              onSubmit={createReservation}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-4 grid gap-3 md:grid-cols-2"
            >
              <input
                className="input"
                required
                placeholder={t('name')}
                value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              />
              <input
                className="input"
                required
                placeholder={t('phone')}
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
              />
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min={1}
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
              />
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                className="input"
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
              <select
                className="input md:col-span-2"
                value={form.tableId}
                onChange={(e) => setForm({ ...form, tableId: e.target.value })}
              >
                <option value="">{t('reservationsNoTable')}</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.label} ({tb.capacity})
                  </option>
                ))}
              </select>
              <textarea
                className="input md:col-span-2"
                placeholder={t('notes')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {t('create')}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {reservations.length === 0 && (
              <p className="text-sm muted border border-dashed rounded-md p-6 text-center">
                {bookingsScope === 'today' ? t('reservationsEmpty') : t('reservationsEmptyFuture')}
              </p>
            )}
            {bookingsScope === 'future' && reservations.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg)]">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--bg-muted)] text-left text-xs uppercase tracking-wide muted">
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
                        <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(dt)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatTime(dt)}
                          </td>
                          <td className="px-3 py-2 font-medium">{r.guestName}</td>
                          <td className="px-3 py-2">{r.partySize}</td>
                          <td className="px-3 py-2">{r.tableLabel || t('reservationsNoTable')}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(r.status)}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {!['cancelled', 'rejected', 'completed', 'no_show'].includes(r.status) ? (
                                <button type="button" className="text-xs underline" onClick={() => openEdit(r)}>
                                  {t('edit')}
                                </button>
                              ) : null}
                              {['pending', 'confirmed'].includes(r.status) ? (
                                <button type="button" className="text-xs text-red-700" onClick={() => setCancelOpen(r.id)}>
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
            ) : null}
            {bookingsScope === 'today'
              ? reservations.map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.guestName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                      <span className="text-xs muted">{r.code}</span>
                      {r.discountPercent ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold border border-amber-300">
                          {r.discountLabel || `${r.discountPercent}% off`}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm muted mt-0.5">
                      {formatDateTime(r.reservedAt)} · {r.partySize} {t('reservationsGuests')} ·{' '}
                      {r.guestPhone}
                      {r.tableLabel
                        ? ` · ${t('reservationsTable')} ${r.tableLabel}${
                            r.discountPercent
                              ? ` · ${r.discountLabel || `${r.discountPercent}% off`}`
                              : ''
                          }`
                        : ''}
                    </p>
                    {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!['cancelled', 'rejected', 'completed', 'no_show'].includes(r.status) ? (
                      <button type="button" className="btn-secondary text-xs !py-1" onClick={() => openEdit(r)}>
                        {t('edit')}
                      </button>
                    ) : null}
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn-primary text-xs !py-1"
                          onClick={() => void runAction(r.id, 'accept')}
                        >
                          {t('reservationsAccept')}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs !py-1"
                          onClick={() => void runAction(r.id, 'reject')}
                        >
                          {t('reservationsReject')}
                        </button>
                      </>
                    )}
                    {['confirmed', 'pending'].includes(r.status) && (
                      <button
                        type="button"
                        className="btn-secondary text-xs !py-1"
                        onClick={() => void runAction(r.id, 'seat')}
                      >
                        {t('reservationsSeat')}
                      </button>
                    )}
                    {r.status === 'seated' && (
                      <button
                        type="button"
                        className="btn-secondary text-xs !py-1"
                        onClick={() => void runAction(r.id, 'complete')}
                      >
                        {t('reservationsComplete')}
                      </button>
                    )}
                    {['pending', 'confirmed'].includes(r.status) && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-red-700 px-2"
                          onClick={() => setCancelOpen(r.id)}
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          className="text-xs muted px-2"
                          onClick={() => void runAction(r.id, 'no_show')}
                        >
                          {t('reservationsNoShow')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {['pending', 'confirmed', 'seated'].includes(r.status) && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="muted">{t('reservationsAssignTable')}</span>
                    <select
                      className="input !w-auto text-sm"
                      value={r.tableId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) void runAction(r.id, 'unassign_table');
                        else void runAction(r.id, 'assign_table', { tableId: v });
                      }}
                    >
                      <option value="">{t('reservationsNoTable')}</option>
                      {tables.map((tb) => (
                        <option key={tb.id} value={tb.id}>
                          {tb.label} ({tb.capacity}) - {tb.status}
                          {r.discountPercent && r.tableId === tb.id
                            ? ` · ${r.discountLabel || `${r.discountPercent}% off`}`
                            : ''}
                        </option>
                      ))}
                    </select>
                    {r.tableLabel && r.discountPercent ? (
                      <span className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        Table {r.tableLabel} · {r.discountLabel || `${r.discountPercent}% off`}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            ))
              : null}
          </div>

          {editId && editing ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form
                onSubmit={saveEdit}
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-xl space-y-3"
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
                      {tb.label} ({tb.capacity}) - {tb.status}
                    </option>
                  ))}
                </select>
                <textarea className="input min-h-24" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder={t('notes')} />
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
            onClose={() => setCancelOpen(null)}
            onConfirm={(reason) => void submitCancel(reason)}
          />
      </div>
    </div>
  );
}
