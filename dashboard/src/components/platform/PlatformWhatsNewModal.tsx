import { ExternalLink, X } from 'lucide-react';
import type { PlatformMessage } from '@/hooks/usePlatformMessages';
import { useI18n } from '@/lib/i18n';

function formatDate(dateStr: string) {
  return new Date(dateStr)
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

export default function PlatformWhatsNewModal({
  open,
  messages,
  onClose,
  onDismiss,
  onDismissAll,
}: {
  open: boolean;
  messages: PlatformMessage[];
  onClose: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-whats-new-title"
    >
      <div className="w-full sm:max-w-lg max-h-[min(90vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-stone-100 dark:border-stone-800">
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {!messages.length ? (
            <p className="text-sm text-stone-500 py-8 text-center">{t('platformNoMessages')}</p>
          ) : (
            messages.map((msg, idx) => (
              <article key={msg.id} className={idx > 0 ? 'pt-6 border-t border-stone-100 dark:border-stone-800' : ''}>
                <p className="text-[11px] font-medium tracking-wide text-stone-400 mb-2">
                  {formatDate(msg.createdAt)}
                </p>
                <div className="flex gap-2 items-start">
                  <span className="mt-2 h-2 w-2 rounded-full bg-red-500 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">{msg.title}</h3>
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
                  <button
                    type="button"
                    onClick={() => onDismiss(msg.id)}
                    className="shrink-0 p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                    aria-label={t('dismiss')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {messages.length ? (
          <div className="px-5 py-3 border-t border-stone-100 dark:border-stone-800 flex justify-end">
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
}
