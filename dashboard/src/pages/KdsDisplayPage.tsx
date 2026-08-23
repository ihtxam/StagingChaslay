import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import { publicApi } from '@/lib/api';
import {
  KDS_SHELL_THEMES,
  kdsChannelBorderClass,
  kdsChannelHeaderClass,
  kdsChannelLabel,
  type KdsShellTheme,
} from '@/lib/kds-channel-styles';
import { playKdsNewOrderOnce } from '@/lib/order-alert';
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

type ItemRow = { kind: 'course'; course: number } | { kind: 'item'; item: KdsItem };

function groupItemsByCourse(items: KdsItem[]): ItemRow[] {
  const courses = [
    ...new Set(items.map((i) => (i.courseNumber != null && i.courseNumber > 0 ? i.courseNumber : 1))),
  ].sort((a, b) => a - b);
  if (courses.length <= 1 && !items.some((i) => i.courseNumber != null && i.courseNumber > 1)) {
    return items.map((item) => ({ kind: 'item', item }));
  }
  const out: ItemRow[] = [];
  for (const course of courses) {
    const inCourse = items.filter((i) => (i.courseNumber || 1) === course);
    if (!inCourse.length) continue;
    out.push({ kind: 'course', course });
    for (const item of inCourse) out.push({ kind: 'item', item });
  }
  return out;
}

export default function KdsDisplayPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [stationName, setStationName] = useState('');
  const [shellTheme, setShellTheme] = useState<KdsShellTheme>('dark');
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [archived, setArchived] = useState<KdsTicket[]>([]);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownItemIds = useRef(new Set<string>());
  const knownTicketIds = useRef(new Set<string>());
  const initialLoad = useRef(true);
  const pollRef = useRef<number | null>(null);

  const theme = KDS_SHELL_THEMES[shellTheme] ?? KDS_SHELL_THEMES.dark;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/kds/${encodeURIComponent(token)}/orders`);
      const rows = (res.data?.tickets || []) as KdsTicket[];
      const active: KdsTicket[] = [];
      const done: KdsTicket[] = [];

      for (const row of rows) {
        const allItems = row.items || [];
        if (!allItems.length) continue;
        if (row.status === 'completed') {
          active.push({ ...row, items: allItems });
        } else {
          const pendingItems = allItems.filter((i) => i.status !== 'ready');
          const readyItems = allItems.filter((i) => i.status === 'ready');
          if (pendingItems.length) {
            active.push({ ...row, items: pendingItems.concat(readyItems) });
          } else if (readyItems.length) {
            active.push({ ...row, items: readyItems });
          }
        }
      }

      if (!initialLoad.current) {
        for (const row of active) {
          if (!knownTicketIds.current.has(row.id)) {
            knownTicketIds.current.add(row.id);
            playKdsNewOrderOnce();
          }
          for (const item of row.items) {
            if (item.status === 'ready') continue;
            if (!knownItemIds.current.has(item.id)) {
              knownItemIds.current.add(item.id);
              playKdsNewOrderOnce();
            }
          }
        }
      } else {
        for (const row of active) {
          knownTicketIds.current.add(row.id);
          for (const item of row.items) knownItemIds.current.add(item.id);
        }
      }
      initialLoad.current = false;

      setStationName(res.data?.station?.name || t('kdsDefaultStationName'));
      const th = String(res.data?.station?.theme || 'dark').toLowerCase();
      setShellTheme(
        th === 'light' || th === 'teal' || th === 'dark' ? (th as KdsShellTheme) : 'dark'
      );
      setTickets(active);
      setArchived(done);
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
      tickets.reduce((n, tk) => n + tk.items.filter((i) => i.status !== 'ready').length, 0),
    [tickets]
  );

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
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === 'active' ? tickets : archived;

  return (
    <div className={`kds-shell min-h-dvh ${theme.shell}`}>
      <header
        className={`sticky top-0 z-10 border-b px-4 py-3 backdrop-blur ${theme.shell} border-black/10`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-widest ${theme.muted}`}>{t('kdsTitle')}</p>
            <h1 className={`text-xl font-bold ${theme.text}`}>{stationName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                tab === 'active' ? 'bg-teal-600 text-white' : 'bg-black/20 text-inherit'
              }`}
            >
              {t('kdsTabPending')} ({pendingCount})
            </button>
            {archived.length > 0 ? (
              <button
                type="button"
                onClick={() => setTab('archived')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  tab === 'archived' ? 'bg-teal-600 text-white' : 'bg-black/20 text-inherit'
                }`}
              >
                {t('kdsTabCompleted')} ({archived.length})
              </button>
            ) : null}
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
          <div className={`flex min-h-[50dvh] items-center justify-center ${theme.muted}`}>
            {tab === 'active' ? t('kdsEmptyPending') : t('kdsEmptyCompleted')}
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
              const isDone = ticket.status === 'completed';
              const rows = groupItemsByCourse(ticket.items);
              const border = kdsChannelBorderClass(ticket.channel);
              const header = kdsChannelHeaderClass(ticket.channel);

              return (
                <article
                  key={ticket.id}
                  className={`flex flex-col rounded-2xl border-2 shadow-lg ${theme.card} ${border}`}
                >
                  <div className={`rounded-t-[14px] px-4 py-3 ${header}`}>
                    <p className="text-lg font-bold">{label || t('kdsTicket')}</p>
                    <p className="text-xs opacity-90">
                      {kdsChannelLabel(ticket.channel)} · {ready}/{total} {t('kdsReadyShort')}
                      {isDone ? ` · ${t('kdsCompletedBadge')}` : ''}
                    </p>
                    {isDone && ticket.completedAt ? (
                      <p className="mt-0.5 text-[10px] opacity-75">
                        {new Date(ticket.completedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : null}
                  </div>
                  <ul className="flex-1 space-y-2 p-3">
                    {rows.map((row, idx) => {
                      if (row.kind === 'course') {
                        return (
                          <li
                            key={`course-${ticket.id}-${row.course}`}
                            className={`rounded-md px-2 py-1 text-center text-xs font-bold uppercase tracking-wide ${
                              shellTheme === 'light'
                                ? 'bg-violet-100 text-violet-800'
                                : 'bg-violet-900/50 text-violet-200'
                            }`}
                          >
                            {`>> ${t('webPosCourse')} ${row.course} <<`}
                          </li>
                        );
                      }
                      const item = row.item;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void (isDone && item.status === 'ready'
                                ? recallItem(item.id)
                                : item.status !== 'ready'
                                  ? markReady(item.id)
                                  : undefined)
                            }
                            title={isDone ? t('kdsRecallItemHint') : undefined}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                              item.status === 'ready' ? theme.itemReady : theme.item
                            } ${theme.text}`}
                          >
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-bold">
                              {item.quantity}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold leading-snug">{item.name}</span>
                              {item.lineNote ? (
                                <span className="mt-0.5 block text-xs text-amber-300/90">
                                  {item.lineNote}
                                </span>
                              ) : null}
                            </span>
                            {item.status === 'ready' ? (
                              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className={`border-t p-3 ${shellTheme === 'light' ? 'border-stone-200' : 'border-black/20'}`}>
                    {!isDone ? (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() => void completeTicket(ticket.id)}
                        className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                      >
                        {t('kdsCompleteTicket')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() => void recallTicket(ticket.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-950/30 disabled:opacity-50"
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
