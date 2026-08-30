import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { dispatchWebPosReservationCreated } from '@/lib/webpos-notifications';
import { reservationStatusBadgeClass } from '@/lib/reservation-badges';

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
      const res = await api.post('/merchant/reservations', {
        guestName,
        guestPhone: sheetForm.guestPhone,
        guestEmail: sheetForm.guestEmail || undefined,
        date: sheetForm.date,
        time: sheetForm.time,
        partySize: Number(sheetForm.partySize),
        notes: sheetForm.notes || undefined,
        tableId: sheetForm.tableId || undefined,
        source: sheetForm.source || 'pos',
        status: sheetForm.status || 'confirmed',
        skipSlotCheck: true,
      });
      const created = res.data?.reservation as Reservation | undefined;
      if (created?.id) {
        dispatchWebPosReservationCreated({
          id: created.id,
          code: created.code,
          guestName: created.guestName,
          partySize: created.partySize,
          reservedAt: created.reservedAt,
          status: created.status || sheetForm.status || 'confirmed',
        });
      }
      toast.success(t('created'));
      setCreateOpen(false);
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || t('cmsSaveFailed'));
      throw err;
    }
  };

  const statusBadge = reservationStatusBadgeClass;

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
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--webpos-bg)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--webpos-border)] bg-[var(--webpos-surface)] px-4 py-3">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            scope === 'today'
              ? 'bg-[var(--webpos-accent)] text-white'
              : 'bg-[var(--webpos-surface-2)] text-[var(--webpos-text-muted)]'
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
              : 'bg-[var(--webpos-surface-2)] text-[var(--webpos-text-muted)]'
          }`}
          onClick={() => setScope('future')}
        >
          {t('reservationsFuture')}
        </button>
        {!autoAccept && pendingCount > 0 ? (
          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
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
          <p className="text-sm text-[var(--webpos-text-muted)]">{t('loading')}</p>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-[var(--webpos-text-muted)]">
            {scope === 'today' ? t('reservationsEmpty') : t('reservationsEmptyFuture')}
          </p>
        ) : scope === 'future' ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--webpos-border)] bg-[var(--webpos-surface)] shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--webpos-border)] bg-[var(--webpos-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--webpos-text-muted)]">
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
                    <tr key={r.id} className="border-b border-[var(--webpos-border)] last:border-0">
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
              <li key={r.id} className="overflow-hidden rounded-xl border border-[var(--webpos-border)] bg-[var(--webpos-surface)] shadow-sm">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.guestName}</p>
                      <p className="text-xs text-[var(--webpos-text-muted)]">
                        {formatTime(r.reservedAt)} · {r.partySize} {t('reservationsGuests')}
                      </p>
                      <p className="text-xs text-[var(--webpos-text-muted)]">{r.guestPhone}</p>
                      {r.guestEmail ? <p className="text-xs text-[var(--webpos-text-muted)]">{r.guestEmail}</p> : null}
                    </div>
                    <div className="text-right text-xs">
                      <p className={`inline-block rounded px-2 py-0.5 font-semibold uppercase ${statusBadge(r.status)}`}>
                        {r.status}
                      </p>
                      <p className="mt-1 text-[var(--webpos-text-muted)]">{r.tableLabel || t('reservationsNoTable')}</p>
                      <p className="text-[var(--webpos-text-muted)]">{r.code}</p>
                    </div>
                  </div>
                  {r.notes ? <p className="mt-2 text-xs text-[var(--webpos-text-muted)]">{r.notes}</p> : null}
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
                  <div className="border-t border-[var(--webpos-border)] bg-[var(--webpos-surface-2)] px-4 py-3">
                    {pendingActions(r)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReservationCreateSheet
        open={createOpen}
        tables={tables}
        defaultSource="pos"
        onClose={() => setCreateOpen(false)}
        onSubmit={createReservation}
      />

      {editId && editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface,var(--bg-elevated))] p-4 shadow-xl space-y-3"
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
