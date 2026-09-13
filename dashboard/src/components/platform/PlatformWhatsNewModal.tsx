import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import type { PlatformTrayMessage } from '@/hooks/usePlatformMessages';
import { useI18n } from '@/lib/i18n';

function formatDate(dateStr: string) {
  return new Date(dateStr)
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

export default function PlatformWhatsNewModal({
  open,
  messages,
  loading = false,
  onClose,
  onDismiss,
  onDismissAll,
}: {
  open: boolean;
  messages: PlatformTrayMessage[];
  loading?: boolean;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}) {
  const { t } = useI18n();

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const unreadIds = messages.filter((m) => m.unread).map((m) => m.id);
  const hasUnread = unreadIds.length > 0;

  const panel = (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-whats-new-title"
    >
      <div className="w-full sm:max-w-lg max-h-[min(90vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div>
            <h2 id="platform-whats-new-title" className="text-xl font-bold text-stone-900 dark:text-stone-100">
              {t('platformWhatsNew')}
            </h2>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
              }}
              className="text-sm text-red-600 hover:underline inline-flex items-center gap-1 mt-1"
            >
              {t('platformSeeAllEntries')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-6 min-h-[10rem] max-h-[min(60vh,520px)]">
          {loading && !messages.length ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">{t('loading')}</p>
          ) : !messages.length ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
                {t('platformNoMessages')}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 max-w-xs">
                {t('platformNoMessagesHint')}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <article
                key={msg.id}
                className={idx > 0 ? 'pt-6 border-t border-stone-100 dark:border-stone-800' : ''}
              >
                <p className="text-[11px] font-medium tracking-wide text-stone-400 mb-2">
                  {formatDate(msg.createdAt)}
                </p>
                <div className="flex gap-2 items-start">
                  <span
                    className={`mt-2 h-2 w-2 rounded-full shrink-0 ${
                      msg.unread ? 'bg-red-500' : 'bg-stone-300 dark:bg-stone-600'
                    }`}
                    aria-label={msg.unread ? t('platformUnread') : t('platformRead')}
                  />
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-base ${
                        msg.unread
                          ? 'font-bold text-stone-900 dark:text-stone-100'
                          : 'font-semibold text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {msg.title}
                    </h3>
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
                  {msg.unread ? (
                    <button
                      type="button"
                      onClick={() => onDismiss(msg.id)}
                      className="shrink-0 p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                      aria-label={t('dismiss')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>

        {hasUnread ? (
          <div className="px-5 py-3 border-t border-stone-100 dark:border-stone-800 flex justify-end shrink-0">
            <button
              type="button"
              onClick={() => {
                onDismissAll();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-stone-600 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {t('platformDismissAll')}
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
