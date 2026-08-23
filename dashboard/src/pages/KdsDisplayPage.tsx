import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type KdsItem = {
  id: string;
  lineId: string;
  name: string;
  quantity: number;
  lineNote?: string | null;
  courseNumber?: number | null;
  status: string;
};

type KdsTicket = {
  id: string;
  ticketKey: string;
  orderNumber?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  channel?: string | null;
  status: string;
  completedAt?: string | null;
  items: KdsItem[];
};

function playNewOrderChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* ignore */
  }
}

export default function KdsDisplayPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [stationName, setStationName] = useState('');
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [completed, setCompleted] = useState<KdsTicket[]>([]);
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownItemIds = useRef(new Set<string>());
  const initialLoad = useRef(true);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/kds/${encodeURIComponent(token)}/orders`);
      const rows = (res.data?.tickets || []) as KdsTicket[];
      const pending: KdsTicket[] = [];
      const done: KdsTicket[] = [];
      for (const row of rows) {
        const allItems = row.items || [];
        const visibleItems = allItems.filter((i) => i.status !== 'ready');
        const readyItems = allItems.filter((i) => i.status === 'ready');
        if (row.status === 'completed') {
          done.push({ ...row, items: allItems });
        } else if (visibleItems.length) {
          pending.push({ ...row, items: visibleItems });
        } else if (readyItems.length) {
          pending.push({ ...row, items: readyItems });
        }
      }
      for (const row of pending) {
        for (const item of row.items) {
          if (item.status === 'ready') continue;
          if (initialLoad.current) {
            knownItemIds.current.add(item.id);
            continue;
          }
          if (!knownItemIds.current.has(item.id)) {
            knownItemIds.current.add(item.id);
            playNewOrderChime();
          }
        }
      }
      initialLoad.current = false;
      setStationName(res.data?.station?.name || t('kdsDefaultStationName'));
      setTickets(pending);
      setCompleted(done);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || t('kdsLoadFailed'));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
    pollRef.current = window.setInterval(() => void load(), 4000);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [load]);

  const pendingCount = useMemo(
    () => tickets.reduce((n, tk) => n + tk.items.filter((i) => i.status !== 'ready').length, 0),
    [tickets]
  );

  const completedCount = completed.length;

  const markReady = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await publicApi.patch(`/kds/${encodeURIComponent(token)}/items/${itemId}/ready`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const recallItem = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await publicApi.patch(`/kds/${encodeURIComponent(token)}/items/${itemId}/recall`);
      setTab('pending');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const completeTicket = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      await publicApi.patch(`/kds/${encodeURIComponent(token)}/tickets/${ticketId}/complete`);
      setTab('completed');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const recallTicket = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      await publicApi.patch(`/kds/${encodeURIComponent(token)}/tickets/${ticketId}/recall`);
      setTab('pending');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === 'pending' ? tickets : completed;

  return (
    <div className="kds-shell min-h-dvh bg-stone-950 text-white">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500">{t('kdsTitle')}</p>
            <h1 className="text-xl font-bold">{stationName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('pending')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                tab === 'pending' ? 'bg-teal-600 text-white' : 'bg-stone-800 text-stone-300'
              }`}
            >
              {t('kdsTabPending')} ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                tab === 'completed' ? 'bg-teal-600 text-white' : 'bg-stone-800 text-stone-300'
              }`}
            >
              {t('kdsTabCompleted')} ({completedCount})
            </button>
          </div>
        </div>
        {error ? (
          <p className="mx-auto mt-2 max-w-6xl rounded-lg bg-red-900/80 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {!list.length ? (
          <div className="flex min-h-[50dvh] items-center justify-center text-stone-500">
            {tab === 'pending' ? t('kdsEmptyPending') : t('kdsEmptyCompleted')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((ticket) => {
              const ready = ticket.items.filter((i) => i.status === 'ready').length;
              const total = ticket.items.length;
              const label = [
                ticket.orderNumber || ticket.ticketKey,
                ticket.tableLabel || ticket.tabNumber,
              ]
                .filter(Boolean)
                .join(' · ');
              const isCompletedTab = tab === 'completed';
              return (
                <article
                  key={ticket.id}
                  className="flex flex-col rounded-2xl border border-stone-800 bg-stone-900 shadow-lg"
                >
                  <div className="border-b border-stone-800 px-4 py-3">
                    <p className="text-lg font-bold">{label || t('kdsTicket')}</p>
                    <p className="text-xs text-stone-400">
                      {ticket.channel || '—'} · {ready}/{total} {t('kdsReadyShort')}
                    </p>
                    {isCompletedTab && ticket.completedAt ? (
                      <p className="mt-0.5 text-[10px] text-stone-500">
                        {new Date(ticket.completedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : null}
                  </div>
                  <ul className="flex-1 space-y-2 p-3">
                    {ticket.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() =>
                            void (isCompletedTab
                              ? recallItem(item.id)
                              : markReady(item.id))
                          }
                          title={
                            isCompletedTab ? t('kdsRecallItemHint') : undefined
                          }
                          className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            isCompletedTab
                              ? 'border-stone-700 bg-stone-800/80 hover:border-amber-500 hover:bg-stone-800'
                              : item.status === 'ready'
                                ? 'border-emerald-700/50 bg-emerald-950/40 opacity-60'
                                : 'border-stone-700 bg-stone-800 hover:border-teal-500 hover:bg-stone-750'
                          }`}
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-700 text-sm font-bold">
                            {item.quantity}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold leading-snug">{item.name}</span>
                            {item.lineNote ? (
                              <span className="mt-0.5 block text-xs text-amber-200/90">
                                {item.lineNote}
                              </span>
                            ) : null}
                            {isCompletedTab ? (
                              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-amber-300/90">
                                {t('kdsRecallItemHint')}
                              </span>
                            ) : null}
                          </span>
                          {isCompletedTab ? (
                            <RotateCcw
                              className="mt-1 h-5 w-5 shrink-0 text-amber-400"
                              aria-hidden
                            />
                          ) : item.status === 'ready' ? (
                            <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-stone-800 p-3">
                    {tab === 'pending' ? (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() => void completeTicket(ticket.id)}
                        className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold hover:bg-teal-500 disabled:opacity-50"
                      >
                        {t('kdsCompleteTicket')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() => void recallTicket(ticket.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-600 py-3 text-sm font-semibold hover:bg-stone-800 disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden />
                        {t('kdsRecallTicket')}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
