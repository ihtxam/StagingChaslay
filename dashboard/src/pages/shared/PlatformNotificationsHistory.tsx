import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PlatformMessage } from '@/hooks/usePlatformMessages';

type HistoryMessage = PlatformMessage & { dismissed?: boolean };

const PAGE_SIZE = 20;

function formatStamp(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: string, t: (key: string) => string) {
  if (kind === 'incident') return t('platformIncident');
  if (kind === 'whats_new') return t('platformWhatsNew');
  return t('platformAnnouncement');
}

export default function PlatformNotificationsHistory() {
  const { t } = useI18n();
  const [items, setItems] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError('');
      }
      try {
        const res = await api.get('/panel/messages/history', {
          params: { offset, limit: PAGE_SIZE },
        });
        const page = (res.data.messages || []) as HistoryMessage[];
        setItems((prev) => (append ? [...prev, ...page] : page));
        setHasMore(!!res.data.hasMore);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('platformNotificationsLoadFailed');
        setError(msg);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          {t('platformNotificationsTitle')}
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          {t('platformNotificationsHint')}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500 py-8 text-center">{t('loading')}</p>
      ) : error ? (
        <p className="text-sm text-red-600 py-8 text-center">{error}</p>
      ) : !items.length ? (
        <p className="text-sm text-stone-500 py-8 text-center">{t('platformNotificationsEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {items.map((msg) => (
            <article
              key={msg.id}
              className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    {formatStamp(msg.createdAt)}
                  </span>
                  <span className="text-[11px] rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-stone-600 dark:text-stone-300">
                    {kindLabel(msg.kind, t)}
                  </span>
                  <span
                    className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${
                      msg.dismissed
                        ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'
                    }`}
                  >
                    {msg.dismissed ? t('platformNotificationsRead') : t('platformNotificationsUnread')}
                  </span>
                </div>
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">{msg.title}</h2>
                <p className="text-sm text-stone-600 dark:text-stone-300 mt-2 whitespace-pre-wrap leading-relaxed">
                  {msg.body}
                </p>
                {msg.externalUrl ? (
                  <a
                    href={msg.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline mt-2"
                  >
                    {msg.externalLabel || msg.externalUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void fetchPage(items.length, true)}
                disabled={loadingMore}
                className="inline-flex items-center rounded-full border border-stone-200 dark:border-stone-600 px-4 py-1.5 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-60"
              >
                {loadingMore ? t('loading') : t('platformNotificationsLoadMore')}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
