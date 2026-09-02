import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import ReservationCancelModal from '@/components/reservations/ReservationCancelModal';
import ReservationCreateSheet, {
  type ReservationCreateForm,
} from '@/components/reservations/ReservationCreateSheet';
import {
  addDaysYmdZurich,
  reservationFormParts,
  ymdZurich,
  zurichDayEndFromYmd,
  zurichDayStartFromYmd,
} from '@/lib/date-format';
import { reservationStatusBadgeClass } from '@/lib/reservation-badges';

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

export default function Reservations() {
  const { t, formatDate, formatDateTime, formatTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [bookingsScope, setBookingsScope] = useState<'today' | 'future' | 'past'>('today');
  const [dateFilter, setDateFilter] = useState(ymdZurich());
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
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

  const loadConfig = useCallback(async () => {
    const res = await api.get('/merchant/reservations/config');
    setEnabled(!!res.data.config?.enabled);
    setMaxDaysAhead(res.data.config?.settings?.maxDaysAhead || 30);
    setTables(res.data.tables || []);
  }, []);

  const loadList = useCallback(async () => {
    const today = ymdZurich();
    let from: Date;
    let to: Date;
    if (bookingsScope === 'today') {
      from = zurichDayStartFromYmd(today);
      to = zurichDayEndFromYmd(today);
    } else if (bookingsScope === 'future') {
      from = zurichDayStartFromYmd(addDaysYmdZurich(1));
      to = zurichDayEndFromYmd(addDaysYmdZurich(maxDaysAhead));
    } else {
      from = zurichDayStartFromYmd(addDaysYmdZurich(-90));
      to = zurichDayEndFromYmd(addDaysYmdZurich(-1));
    }
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

  const createReservation = async (sheetForm: ReservationCreateForm) => {
    if (!enabled) {
      toast.error(t('reservationsDisabledHint'));
      throw new Error('reservations_disabled');
    }
    const guestName = [sheetForm.guestFirstName, sheetForm.guestLastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');
    try {
      await api.post('/merchant/reservations', {
        guestName,
        guestPhone: sheetForm.guestPhone,
        guestEmail: sheetForm.guestEmail || undefined,
        date: sheetForm.date,
        time: sheetForm.time,
        partySize: Number(sheetForm.partySize),
        notes: sheetForm.notes || undefined,
        tableId: sheetForm.tableId || undefined,
        source: sheetForm.source || 'phone',
        status: sheetForm.status || 'confirmed',
        skipSlotCheck: true,
      });
      setCreateOpen(false);
      toast.success(t('created'));
      await loadList();
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
      throw err;
    }
  };

  const statusBadge = reservationStatusBadgeClass;

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.status === 'pending').length,
    [reservations]
  );

  const sortedReservations = useMemo(() => {
    const rows = [...reservations];
    if (bookingsScope === 'past') {
      rows.sort((a, b) => new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime());
    } else {
      rows.sort((a, b) => new Date(a.reservedAt).getTime() - new Date(b.reservedAt).getTime());
    }
    return rows;
  }, [bookingsScope, reservations]);

  const useTableLayout = bookingsScope === 'future' || bookingsScope === 'past';

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
          <span className="text-sm rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100 px-3 py-2">
            {t('reservationsPendingCount').replace('{n}', String(pendingCount))}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
          {!enabled && (
            <p className="text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 px-3 py-2">
              {t('reservationsDisabledHint')}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${
                  bookingsScope === 'today'
                    ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg-elevated)]'
                    : 'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
                onClick={() => setBookingsScope('today')}
              >
                {t('reservationsToday')}
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${
                  bookingsScope === 'future'
                    ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg-elevated)]'
                    : 'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
                onClick={() => setBookingsScope('future')}
              >
                {t('reservationsFuture')}
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${
                  bookingsScope === 'past'
                    ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg-elevated)]'
                    : 'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
                onClick={() => setBookingsScope('past')}
              >
                {t('reservationsPast')}
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
            <button
              type="button"
              className="btn-primary"
              disabled={!enabled}
              onClick={() => {
                if (!enabled) {
                  toast.error(t('reservationsDisabledHint'));
                  return;
                }
                setCreateOpen(true);
              }}
            >
              {t('reservationsNew')}
            </button>
          </div>

          <ReservationCreateSheet
            open={createOpen}
            tables={tables}
            onClose={() => setCreateOpen(false)}
            onSubmit={createReservation}
          />

          <div className="space-y-2">
            {sortedReservations.length === 0 && (
              <p className="text-sm muted border border-dashed rounded-md p-6 text-center">
                {bookingsScope === 'today'
                  ? t('reservationsEmpty')
                  : bookingsScope === 'future'
                    ? t('reservationsEmptyFuture')
                    : t('reservationsEmptyPast')}
              </p>
            )}
            {useTableLayout && sortedReservations.length > 0 ? (
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
                    {sortedReservations.map((r) => {
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
                                <button type="button" className="text-xs text-red-700 dark:text-red-400" onClick={() => setCancelOpen(r.id)}>
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
              ? sortedReservations.map((r) => (
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
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold border border-amber-300 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-800">
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
                          className="text-xs text-red-700 dark:text-red-400 px-2"
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
                      <span className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800">
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
