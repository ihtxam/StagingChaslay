import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type HostRow = {
  id: string;
  code: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservedAt: string;
  status: string;
  tableLabel?: string | null;
  quotedWaitMinutes?: number | null;
  extras?: { depositStatus?: string | null; lastGuestSmsAt?: string | null } | null;
};

type Table = { id: string; label: string; capacity: number; status: string };

export default function HostStation() {
  const { t, formatTime } = useI18n();
  const [waitlist, setWaitlist] = useState<HostRow[]>([]);
  const [book, setBook] = useState<HostRow[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/merchant/reservations/host');
      setWaitlist(res.data.waitlist || []);
      setBook(res.data.book || []);
      setTables(res.data.tables || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const act = async (id: string, action: string) => {
    try {
      await api.post(`/merchant/reservations/${id}/action`, { action });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const textGuest = async (id: string, kind: 'table_ready' | 'waitlist') => {
    try {
      await api.post(`/merchant/reservations/${id}/notify`, { kind });
      toast.success(t('hostSmsSent'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const markDeposit = async (id: string) => {
    try {
      await api.post(`/merchant/reservations/${id}/deposit`, { status: 'collected' });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('hostStationTitle')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('hostStationHint')}</p>
        </div>
        <Link to="/merchant/sales/reservations" className="btn-secondary text-sm">
          {t('reservations')}
        </Link>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {t('hostWaitlist')} ({waitlist.length})
          </h2>
          <div className="mt-3 space-y-2">
            {waitlist.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t('hostWaitlistEmpty')}</p>
            ) : (
              waitlist.map((r) => (
                <article key={r.id} className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-bold">{r.guestName}</p>
                    <p className="text-lg font-black text-violet-800">
                      ~{r.quotedWaitMinutes || '—'} {t('hostMin')}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {r.partySize} · {formatTime(r.reservedAt)} · {r.guestPhone}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" className="btn-primary text-xs" onClick={() => void act(r.id, 'promote_waitlist')}>
                      {t('reservationsPromoteWaitlist')}
                    </button>
                    <button type="button" className="btn-secondary text-xs" onClick={() => void textGuest(r.id, 'table_ready')}>
                      {t('hostTextReady')}
                    </button>
                    <button type="button" className="btn-secondary text-xs" onClick={() => void act(r.id, 'seat')}>
                      {t('reservationsSeat')}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {t('hostBook')} ({book.length})
          </h2>
          <div className="mt-3 space-y-2">
            {book.map((r) => (
              <article key={r.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-bold">{r.guestName}</p>
                  <span className="text-xs font-semibold uppercase">{r.status}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {r.partySize} · {formatTime(r.reservedAt)} · {r.tableLabel || '—'}
                </p>
                {r.extras?.depositStatus && r.extras.depositStatus !== 'none' ? (
                  <p className="mt-1 text-xs font-semibold">
                    {t('hostDeposit')}: {r.extras.depositStatus}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.status !== 'seated' ? (
                    <button type="button" className="btn-primary text-xs" onClick={() => void act(r.id, 'seat')}>
                      {t('reservationsSeat')}
                    </button>
                  ) : (
                    <button type="button" className="btn-primary text-xs" onClick={() => void act(r.id, 'complete')}>
                      {t('reservationsComplete')}
                    </button>
                  )}
                  <button type="button" className="btn-secondary text-xs" onClick={() => void textGuest(r.id, 'table_ready')}>
                    {t('hostTextReady')}
                  </button>
                  {r.extras?.depositStatus === 'due' ? (
                    <button type="button" className="btn-secondary text-xs" onClick={() => void markDeposit(r.id)}>
                      {t('hostDepositTaken')}
                    </button>
                  ) : null}
                  <button type="button" className="btn-secondary text-xs" onClick={() => void act(r.id, 'no_show')}>
                    {t('reservationsNoShow')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {t('hostTables')}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`rounded-xl border px-3 py-3 text-sm ${
                  table.status === 'available'
                    ? 'border-emerald-200 bg-emerald-50'
                    : table.status === 'occupied'
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-[var(--border)] bg-[var(--bg-muted)]/40'
                }`}
              >
                <p className="font-bold">{table.label}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {table.capacity} · {table.status}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
