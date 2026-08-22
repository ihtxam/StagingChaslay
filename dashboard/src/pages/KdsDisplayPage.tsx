import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChefHat, RotateCcw } from 'lucide-react';
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
  items: KdsItem[];
};

/** Audible ring when a new kitchen order arrives. */
function playKitchenRing() {
  try {
    const ctx = new AudioContext();
    const tones: Array<[number, number, number]> = [
      [880, 0, 0.22],
      [1175, 0.26, 0.22],
      [880, 0.52, 0.32],
    ];
    for (const [freq, offset, dur] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      const start = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
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
  const knownTicketIds = useRef(new Set<string>());
  const knownItemIds = useRef(new Set<string>());
  const initialLoad = useRef(true);
  const pollRef = useRef<number | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/kds/${encodeURIComponent(token)}/orders`);
      const rows = (res.data?.tickets || []) as KdsTicket[];
      const pending: KdsTicket[] = [];
      const done: KdsTicket[] = [];
      for (const row of rows) {
        const items = row.items || [];
        if (row.status === 'completed') {
          done.push({ ...row, items });
        } else if (items.length) {
          pending.push({ ...row, items });
        }
      }

      if (!initialLoad.current) {
        let rang = false;
        for (const row of pending) {
          if (!knownTicketIds.current.has(row.id)) {
            knownTicketIds.current.add(row.id);
            playKitchenRing();
            rang = true;
            break;
          }
        }
        if (!rang) {
          for (const row of pending) {
            for (const item of row.items) {
              if (!knownItemIds.current.has(item.id)) {
                knownItemIds.current.add(item.id);
                playKitchenRing();
                rang = true;
                break;
              }
            }
            if (rang) break;
          }
        }
      } else {
        for (const row of pending) {
          knownTicketIds.current.add(row.id);
          for (const item of row.items) knownItemIds.current.add(item.id);
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
    () =>
      tickets.reduce(
        (n, tk) => n + tk.items.filter((i) => i.status !== 'ready').length,
        0
      ),
    [tickets]
  );

  const markReady = async (itemId: string, ticketId: string) => {
    setBusyId(itemId);
    try {
      await publicApi.patch(`/kds/${encodeURIComponent(token)}/items/${itemId}/ready`);
      await load();
      const ticket = tickets.find((tk) => tk.id === ticketId);
      const remaining =
        ticket?.items.filter((i) => i.id !== itemId && i.status !== 'ready').length ?? 0;
      if (remaining === 0) {
        setTab('completed');
      }
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

  const renderTicket = (ticket: KdsTicket, mode: 'pending' | 'completed') => {
    const ready = ticket.items.filter((i) => i.status === 'ready').length;
    const total = ticket.items.length;
    const label = [
      ticket.orderNumber || ticket.ticketKey.split('@')[0],
      ticket.tableLabel || ticket.tabNumber,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <article
        key={ticket.id}
        className="kds-ticket-column flex h-full w-[min(88vw,340px)] shrink-0 snap-start flex-col rounded-2xl border border-stone-800 bg-stone-900 shadow-lg"
      >
        <div className="border-b border-stone-800 px-4 py-3">
          <p className="text-lg font-bold leading-tight">{label || t('kdsTicket')}</p>
          <p className="text-xs text-stone-400">
            {ticket.channel || '—'} · {ready}/{total} {t('kdsReadyShort')}
          </p>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-3">
          {ticket.items.map((item) => {
            const isReady = item.status === 'ready';
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busyId === item.id || isReady || mode === 'completed'}
                  onClick={() => void markReady(item.id, ticket.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    isReady
                      ? 'border-amber-600/40 bg-amber-950/30'
                      : 'border-stone-700 bg-stone-800 hover:border-teal-500 hover:bg-stone-750 active:scale-[0.99]'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isReady ? 'bg-amber-700/50 text-amber-100' : 'bg-stone-700'
                    }`}
                  >
                    {item.quantity}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-semibold leading-snug ${
                        isReady ? 'text-stone-400 line-through decoration-stone-600' : ''
                      }`}
                    >
                      {item.name}
                    </span>
                    {item.lineNote ? (
                      <span className="mt-0.5 block text-xs text-amber-200/90">{item.lineNote}</span>
                    ) : null}
                  </span>
                  {isReady ? (
                    <ChefHat
                      className="mt-0.5 h-6 w-6 shrink-0 text-amber-400"
                      aria-label={t('kdsItemReady')}
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-stone-800 p-3">
          {mode === 'pending' ? (
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
  };

  return (
    <div className="kds-shell flex min-h-dvh flex-col bg-stone-950 text-white">
      <header className="sticky top-0 z-10 shrink-0 border-b border-stone-800 bg-stone-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
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
              {t('kdsTabCompleted')}
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-2 rounded-lg bg-red-900/80 px-3 py-2 text-sm text-red-100">{error}</p>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 p-4">
        {!list.length ? (
          <div className="flex min-h-[50dvh] items-center justify-center text-stone-500">
            {tab === 'pending' ? t('kdsEmptyPending') : t('kdsEmptyCompleted')}
          </div>
        ) : (
          <div
            ref={railRef}
            className="kds-ticket-rail flex h-[calc(100dvh-5.5rem)] gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory touch-pan-x"
          >
            {list.map((ticket) => renderTicket(ticket, tab))}
          </div>
        )}
      </main>
    </div>
  );
}
