import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Clock, RotateCcw } from 'lucide-react';
import { publicApi } from '@/lib/api';
import KdsGridColumnsPicker, {
  readKdsGridColumnsOverride,
  writeKdsGridColumnsOverride,
} from '@/components/kds/KdsGridColumnsPicker';
import KdsLayoutModePicker, {
  readKdsLayoutModeOverride,
  writeKdsLayoutModeOverride,
  type KdsLayoutMode,
} from '@/components/kds/KdsLayoutModePicker';
import {
  KDS_SHELL_THEMES,
  kdsChannelBorderClass,
  kdsChannelHeaderClass,
  kdsChannelLabel,
  type KdsShellTheme,
} from '@/lib/kds-channel-styles';
import { playKdsNewOrderOnce, playKitchenOverdueOnce } from '@/lib/order-alert';
import { useI18n } from '@/lib/i18n';

type ChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery';

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
  createdAt?: string | null;
  completedAt?: string | null;
  items: KdsItem[];
};

type ItemRow = { kind: 'course'; course: number } | { kind: 'item'; item: KdsItem };

type DisplayTicket = KdsTicket & {
  allItems: KdsItem[];
  viewMode: 'pending' | 'summary';
};

const CHANNEL_FILTERS: ChannelFilter[] = ['all', 'dine_in', 'takeaway', 'delivery'];
/** Time to show all-ready summary before auto-completing the ticket. */
const KDS_AUTO_COMPLETE_MS = 4000;

function splitTicketForDisplay(row: KdsTicket): DisplayTicket | null {
  const allItems = row.items || [];
  if (!allItems.length) return null;
  if (row.status === 'cancelled') {
    return { ...row, allItems, viewMode: 'pending', items: allItems };
  }
  const pendingItems = allItems.filter((i) => i.status !== 'ready');
  if (pendingItems.length) {
    return { ...row, allItems, viewMode: 'pending', items: pendingItems };
  }
  return { ...row, allItems, viewMode: 'summary', items: allItems };
}

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

function formatOrderAge(fromMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function ticketArrivedMs(ticket: KdsTicket): number {
  if (ticket.createdAt) return new Date(ticket.createdAt).getTime();
  return Date.now();
}

function matchesChannelFilter(channel: string | null | undefined, filter: ChannelFilter): boolean {
  if (filter === 'all') return true;
  const ch = String(channel || 'takeaway').toLowerCase();
  return ch === filter;
}

function channelFilterLabel(filter: ChannelFilter, t: (k: string) => string): string {
  if (filter === 'all') return t('webPosAllOrders');
  if (filter === 'dine_in') return t('dineIn');
  if (filter === 'takeaway') return t('takeaway');
  return t('delivery');
}

type TicketCardProps = {
  ticket: DisplayTicket;
  tab: 'active' | 'archived';
  shellTheme: KdsShellTheme;
  theme: (typeof KDS_SHELL_THEMES)[KdsShellTheme];
  nowMs: number;
  overdueMinutes: number;
  busyId: string | null;
  onMarkReady: (id: string) => void;
  onRecallItem: (id: string) => void;
  onComplete: (id: string) => void;
  onRecallTicket: (id: string) => void;
  t: (k: string) => string;
};

function TicketCard({
  ticket,
  tab,
  shellTheme,
  theme,
  nowMs,
  overdueMinutes,
  busyId,
  onMarkReady,
  onRecallItem,
  onComplete,
  onRecallTicket,
  t,
}: TicketCardProps) {
  const ready = ticket.allItems.filter((i) => i.status === 'ready').length;
  const total = ticket.allItems.length;
  const allReadySummary = tab === 'active' && ticket.viewMode === 'summary';
  const [autoProgress, setAutoProgress] = useState(0);
  const autoCompleteRef = useRef<number | null>(null);
  const autoTriggeredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!allReadySummary || busyId === ticket.id) {
      autoTriggeredRef.current = false;
      setAutoProgress(0);
      if (autoCompleteRef.current != null) {
        window.clearInterval(autoCompleteRef.current);
        autoCompleteRef.current = null;
      }
      return;
    }
    if (autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    const startedAt = Date.now();
    autoCompleteRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / KDS_AUTO_COMPLETE_MS) * 100);
      setAutoProgress(pct);
      if (pct >= 100) {
        if (autoCompleteRef.current != null) {
          window.clearInterval(autoCompleteRef.current);
          autoCompleteRef.current = null;
        }
        onCompleteRef.current(ticket.id);
      }
    }, 40);
    return () => {
      if (autoCompleteRef.current != null) {
        window.clearInterval(autoCompleteRef.current);
        autoCompleteRef.current = null;
      }
    };
  }, [allReadySummary, busyId, ticket.id]);

  const label = [ticket.orderNumber || ticket.ticketKey, ticket.tableLabel || ticket.tabNumber]
    .filter(Boolean)
    .join(' · ');
  const isCancelled = ticket.status === 'cancelled';
  const isDone = ticket.status === 'completed' || tab === 'archived';
  const rows = groupItemsByCourse(ticket.items);
  const border = isCancelled ? 'border-red-600' : kdsChannelBorderClass(ticket.channel);
  const header = isCancelled ? 'bg-red-700 text-white' : kdsChannelHeaderClass(ticket.channel);
  const arrivedMs = ticketArrivedMs(ticket);
  const ageSec = Math.max(0, Math.floor((nowMs - arrivedMs) / 1000));
  const isOverdue = !isDone && ageSec >= overdueMinutes * 60;

  return (
    <article
      className={`flex h-full min-h-0 flex-col rounded-2xl border-2 shadow-lg ${theme.card} ${border} ${
        isCancelled
          ? 'bg-red-950/30 ring-2 ring-red-500 ring-offset-2 ring-offset-transparent'
          : isOverdue
            ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent'
            : ''
      }`}
    >
      <div className={`rounded-t-[14px] px-4 py-3 ${header}`}>
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-lg font-bold min-w-0 truncate ${isCancelled ? 'line-through decoration-red-300 decoration-2' : ''}`}
          >
            {label || t('kdsTicket')}
          </p>
          {!isDone && !isCancelled ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                isOverdue ? 'bg-amber-500 text-black' : 'bg-black/25'
              }`}
              title={t('kdsOrderTimer')}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {formatOrderAge(arrivedMs, nowMs)}
            </span>
          ) : null}
        </div>
        <p className="text-xs opacity-90">
          {isCancelled ? (
            <span className="font-bold uppercase tracking-wide text-red-100">{t('kdsCancelledBadge')}</span>
          ) : (
            <>
              {kdsChannelLabel(ticket.channel)} · {ready}/{total} {t('kdsReadyShort')}
              {isDone ? ` · ${t('kdsCompletedBadge')}` : ''}
              {isOverdue ? ` · ${t('kdsOverdueBadge')}` : ''}
            </>
          )}
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
      {allReadySummary ? (
        <div className="border-b border-emerald-500/30 bg-emerald-950/40 px-4 py-2">
          <p className="text-center text-xs font-semibold text-emerald-300">{t('kdsAllReadyHint')}</p>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(autoProgress)}
            aria-label={t('kdsAutoCompleting')}
          >
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-300 transition-[width] duration-75 ease-linear"
              style={{ width: `${autoProgress}%` }}
            >
              <span className="absolute inset-y-0 right-0 w-8 bg-white/25 blur-sm" aria-hidden />
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10px] font-medium tabular-nums text-emerald-200/80">
            {t('kdsAutoCompleting')}
          </p>
        </div>
      ) : null}
      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {rows.map((row) => {
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
          const itemCancelled = isCancelled || item.status === 'cancelled';
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={busyId === item.id || itemCancelled}
                onClick={() =>
                  void (isDone && item.status === 'ready'
                    ? onRecallItem(item.id)
                    : item.status !== 'ready' && !itemCancelled
                      ? onMarkReady(item.id)
                      : undefined)
                }
                title={isDone ? t('kdsRecallItemHint') : undefined}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  itemCancelled
                    ? 'border-red-500/50 bg-red-950/50 line-through opacity-90'
                    : item.status === 'ready'
                      ? theme.itemReady
                      : theme.item
                } ${theme.text}`}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-bold">
                  {item.quantity}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-semibold leading-snug ${
                      itemCancelled || item.status === 'ready' ? 'line-through opacity-80' : ''
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.lineNote ? (
                    <span className="mt-0.5 block text-xs text-amber-300/90">{item.lineNote}</span>
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
        {isCancelled ? (
          <button
            type="button"
            disabled={busyId === ticket.id}
            onClick={() => void onComplete(ticket.id)}
            className="w-full rounded-xl border border-red-400/60 bg-red-900/40 py-3 text-sm font-bold text-red-100 hover:bg-red-900/60 disabled:opacity-50"
          >
            {t('kdsDismissCancelled')}
          </button>
        ) : isDone ? (
          <button
            type="button"
            disabled={busyId === ticket.id}
            onClick={() => void onRecallTicket(ticket.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-950/30 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('kdsRecallTicket')}
          </button>
        ) : allReadySummary ? null : (
          <button
            type="button"
            disabled={busyId === ticket.id}
            onClick={() => void onComplete(ticket.id)}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {t('kdsCompleteTicket')}
          </button>
        )}
      </div>
    </article>
  );
}

export default function KdsDisplayPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [stationName, setStationName] = useState('');
  const [shellTheme, setShellTheme] = useState<KdsShellTheme>('dark');
  const [layoutMode, setLayoutMode] = useState<KdsLayoutMode>('grid');
  const [gridColumns, setGridColumns] = useState(3);
  const [overdueMinutes, setOverdueMinutes] = useState(20);
  const [fullTickets, setFullTickets] = useState<KdsTicket[]>([]);
  const [archived, setArchived] = useState<KdsTicket[]>([]);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const knownItemIds = useRef(new Set<string>());
  const knownTicketIds = useRef(new Set<string>());
  const overdueRungRef = useRef(new Set<string>());
  const initialLoad = useRef(true);
  const pollRef = useRef<number | null>(null);
  const gridColumnsOverrideRef = useRef<number | null>(readKdsGridColumnsOverride(token));
  const layoutModeOverrideRef = useRef<KdsLayoutMode | null>(readKdsLayoutModeOverride(token));

  const theme = KDS_SHELL_THEMES[shellTheme] ?? KDS_SHELL_THEMES.dark;

  const applyLayoutMode = useCallback(
    (mode: KdsLayoutMode) => {
      const next = writeKdsLayoutModeOverride(token, mode);
      layoutModeOverrideRef.current = next;
      setLayoutMode(next);
    },
    [token]
  );

  const applyGridColumns = useCallback(
    (columns: number) => {
      const next = writeKdsGridColumnsOverride(token, columns);
      gridColumnsOverrideRef.current = next;
      setGridColumns(next);
    },
    [token]
  );

  const checkOverdue = useCallback(
    (pending: DisplayTicket[]) => {
      const limitMs = overdueMinutes * 60 * 1000;
      const now = Date.now();
      for (const ticket of pending) {
        if (ticket.status === 'completed') continue;
        const hasPendingItems = ticket.allItems.some((i) => i.status !== 'ready');
        if (!hasPendingItems) continue;
        const age = now - ticketArrivedMs(ticket);
        if (age >= limitMs && !overdueRungRef.current.has(ticket.id)) {
          overdueRungRef.current.add(ticket.id);
          playKitchenOverdueOnce();
        }
      }
    },
    [overdueMinutes]
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/kds/${encodeURIComponent(token)}/orders`);
      const rows = (res.data?.tickets || []) as KdsTicket[];
      const activeFull: KdsTicket[] = [];
      const done: KdsTicket[] = [];

      for (const row of rows) {
        const allItems = row.items || [];
        if (!allItems.length) continue;
        if (row.status === 'completed') {
          done.push({ ...row, items: allItems });
        } else {
          activeFull.push({ ...row, items: allItems });
        }
      }

      const activeDisplay = activeFull
        .map(splitTicketForDisplay)
        .filter((row): row is DisplayTicket => row != null);

      if (!initialLoad.current) {
        for (const row of activeDisplay) {
          if (row.status === 'cancelled') continue;
          if (!knownTicketIds.current.has(row.id)) {
            knownTicketIds.current.add(row.id);
            playKdsNewOrderOnce();
          }
          for (const item of row.allItems) {
            if (item.status === 'ready') continue;
            if (!knownItemIds.current.has(item.id)) {
              knownItemIds.current.add(item.id);
              playKdsNewOrderOnce();
            }
          }
        }
        checkOverdue(activeDisplay);
      } else {
        for (const row of activeDisplay) {
          knownTicketIds.current.add(row.id);
          for (const item of row.allItems) knownItemIds.current.add(item.id);
        }
        for (const row of activeDisplay) {
          const age = Date.now() - ticketArrivedMs(row);
          if (age >= overdueMinutes * 60 * 1000) overdueRungRef.current.add(row.id);
        }
      }

      const st = res.data?.station || {};
      setStationName(st.name || t('kdsDefaultStationName'));
      const th = String(st.theme || 'dark').toLowerCase();
      setShellTheme(th === 'light' || th === 'teal' || th === 'dark' ? (th as KdsShellTheme) : 'dark');
      if (initialLoad.current) {
        const lm = String(st.layoutMode || 'grid').toLowerCase();
        const serverMode: KdsLayoutMode =
          lm === 'rows' || lm === 'slider' ? (lm as KdsLayoutMode) : 'grid';
        const localMode = layoutModeOverrideRef.current ?? readKdsLayoutModeOverride(token);
        layoutModeOverrideRef.current = localMode;
        setLayoutMode(localMode ?? serverMode);
        const serverCols = Math.min(6, Math.max(1, Number(st.gridColumns) || 3));
        const localCols = gridColumnsOverrideRef.current ?? readKdsGridColumnsOverride(token);
        gridColumnsOverrideRef.current = localCols;
        setGridColumns(localCols ?? serverCols);
      }

      initialLoad.current = false;
      setOverdueMinutes(Math.min(120, Math.max(5, Number(st.overdueMinutes) || 20)));
      setFullTickets(activeFull);
      setArchived(done);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || t('kdsLoadFailed'));
    }
  }, [token, t, checkOverdue, overdueMinutes]);

  useEffect(() => {
    gridColumnsOverrideRef.current = readKdsGridColumnsOverride(token);
    layoutModeOverrideRef.current = readKdsLayoutModeOverride(token);
  }, [token]);

  useEffect(() => {
    void load();
    pollRef.current = window.setInterval(() => void load(), 4000);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(tick);
  }, []);

  const displayTickets = useMemo(
    () =>
      fullTickets
        .map(splitTicketForDisplay)
        .filter((row): row is DisplayTicket => row != null),
    [fullTickets]
  );

  useEffect(() => {
    checkOverdue(displayTickets);
  }, [nowMs, displayTickets, checkOverdue]);

  const pendingCount = useMemo(
    () =>
      fullTickets.reduce((n, tk) => {
        if (tk.status === 'cancelled') return n;
        return n + tk.items.filter((i) => i.status !== 'ready' && i.status !== 'cancelled').length;
      }, 0),
    [fullTickets]
  );

  const filteredTickets = useMemo(
    () => displayTickets.filter((tk) => matchesChannelFilter(tk.channel, channelFilter)),
    [displayTickets, channelFilter]
  );

  const filteredArchived = useMemo(
    () => archived.filter((tk) => matchesChannelFilter(tk.channel, channelFilter)),
    [archived, channelFilter]
  );

  const list = tab === 'active' ? filteredTickets : filteredArchived;

  const markReady = async (itemId: string) => {
    setBusyId(itemId);
    setFullTickets((prev) =>
      prev.map((ticket) => {
        if (!ticket.items.some((i) => i.id === itemId)) return ticket;
        return {
          ...ticket,
          items: ticket.items.map((i) => (i.id === itemId ? { ...i, status: 'ready' } : i)),
        };
      })
    );
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
      await load();
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
    const snapshot = fullTickets.find((t) => t.id === ticketId);
    overdueRungRef.current.delete(ticketId);
    setFullTickets((prev) => prev.filter((t) => t.id !== ticketId));
    if (snapshot) {
      const nowIso = new Date().toISOString();
      setArchived((prev) => [
        {
          ...snapshot,
          status: 'completed',
          completedAt: nowIso,
          items: snapshot.items.map((i) => ({ ...i, status: 'ready' })),
        },
        ...prev,
      ]);
    }
    try {
      await publicApi.patch(`/kds/${encodeURIComponent(token)}/tickets/${ticketId}/complete`);
      setTab('completed');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || t('kdsActionFailed'));
      await load();
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

  const layoutClass =
    layoutMode === 'rows'
      ? 'flex flex-col gap-4'
      : layoutMode === 'slider'
        ? 'flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        : 'grid gap-4';

  const layoutStyle =
    layoutMode === 'grid'
      ? { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }
      : undefined;

  const cardWrapClass = layoutMode === 'slider' ? 'w-[min(340px,85vw)] shrink-0 snap-start' : '';

  const channelFilterBtnClass = (active: boolean) =>
    active
      ? shellTheme === 'light'
        ? 'bg-stone-800 text-white'
        : 'bg-white/20 text-white ring-1 ring-white/30'
      : shellTheme === 'light'
        ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
        : 'bg-black/15 text-inherit hover:bg-black/25';

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
    <div className={`kds-shell min-h-dvh ${theme.shell}`}>
      <header className={`sticky top-0 z-10 border-b px-3 py-2 backdrop-blur sm:px-4 ${theme.shell} border-black/10`}>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="mr-1 min-w-0 shrink-0">
            <p className={`text-[10px] uppercase tracking-widest leading-none ${theme.muted}`}>{t('kdsTitle')}</p>
            <h1 className={`truncate text-base font-bold leading-tight sm:text-lg ${theme.text}`}>{stationName}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:py-2 sm:text-sm ${
                tab === 'active' ? 'bg-teal-600 text-white' : 'bg-black/20 text-inherit'
              }`}
            >
              {t('kdsTabPending')} ({pendingCount})
            </button>
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setChannelFilter(f)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:py-1.5 sm:text-xs ${channelFilterBtnClass(channelFilter === f)}`}
              >
                {channelFilterLabel(f, t)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab('archived')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:py-2 sm:text-sm ${
                tab === 'archived' ? 'bg-teal-600 text-white' : 'bg-black/20 text-inherit'
              }`}
            >
              {t('kdsTabCompleted')} ({archived.length})
            </button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <KdsLayoutModePicker compact value={layoutMode} onChange={applyLayoutMode} />
            {layoutMode === 'grid' ? (
              <KdsGridColumnsPicker compact value={gridColumns} onChange={applyGridColumns} />
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mx-auto mt-1.5 max-w-[1600px] rounded-lg bg-red-900/80 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1600px] p-4">
        {!list.length ? (
          <div className={`flex min-h-[50dvh] items-center justify-center ${theme.muted}`}>
            {tab === 'active' ? t('kdsEmptyPending') : t('kdsEmptyCompleted')}
          </div>
        ) : (
          <div className={layoutClass} style={layoutStyle}>
            {list.map((ticket) => (
              <div key={ticket.id} className={cardWrapClass}>
                <TicketCard
                  ticket={ticket}
                  tab={tab}
                  shellTheme={shellTheme}
                  theme={theme}
                  nowMs={nowMs}
                  overdueMinutes={overdueMinutes}
                  busyId={busyId}
                  onMarkReady={(id) => void markReady(id)}
                  onRecallItem={(id) => void recallItem(id)}
                  onComplete={(id) => void completeTicket(id)}
                  onRecallTicket={(id) => void recallTicket(id)}
                  t={t}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
