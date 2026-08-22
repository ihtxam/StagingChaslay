import { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import type { PlatformMessage } from '@/hooks/usePlatformMessages';
import { useI18n } from '@/lib/i18n';

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'about 1 month ago' : `about ${months} months ago`;
}

function formatStamp(dateStr: string) {
  return new Date(dateStr)
    .toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .toUpperCase();
}

export default function PlatformStatusBanner({
  messages,
  onDismiss,
  onDismissAll,
}: {
  messages: PlatformMessage[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const incidents = useMemo(
    () => messages.filter((m) => m.kind === 'incident' || m.showInBanner),
    [messages]
  );

  if (!incidents.length) return null;

  const lastUpdated = incidents[0]?.updatedAt || incidents[0]?.createdAt;

  return (
    <div className="border-b border-stone-200 bg-white dark:bg-stone-900 dark:border-stone-700">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
            {t('platformStatusTitle')}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {t('platformStatusCount').replace('{n}', String(incidents.length))}
            {' · '}
            {t('platformStatusUpdated').replace('{when}', formatRelative(lastUpdated))}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-stone-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
        )}
      </button>

      {expanded ? (
        <div className="px-4 pb-4 space-y-3">
          {incidents.map((msg) => (
            <article
              key={msg.id}
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 shadow-sm"
            >
              <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                    <AlertCircle className="w-4 h-4" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm leading-snug">
                      {msg.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onDismiss(msg.id)}
                      className="shrink-0 p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                      aria-label={t('dismiss')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    {t('platformStatusCreated')}: {formatStamp(msg.createdAt)}
                  </p>
                  {msg.updatedAt !== msg.createdAt ? (
                    <p className="text-xs text-stone-500">
                      {t('platformStatusLastUpdated')}: {formatRelative(msg.updatedAt)}
                    </p>
                  ) : null}
                  <p className="text-sm text-stone-700 dark:text-stone-300 mt-3 whitespace-pre-wrap leading-relaxed">
                    {msg.body}
                  </p>
                  {msg.externalUrl ? (
                    <a
                      href={msg.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-600 px-3 py-2 text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      {msg.externalLabel || t('platformStatusDetails')}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={() => onDismissAll()}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-stone-600 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            {t('platformDismissAll')}
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
