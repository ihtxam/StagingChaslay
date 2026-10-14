import { LifeBuoy, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlatformMessage } from '@/hooks/usePlatformMessages';
import { useI18n } from '@/lib/i18n';
import { isInternalPanelPath } from '@/lib/support-ticket-alert';

export default function SupportTicketAlertBanner({
  messages,
  onDismiss,
}: {
  messages: PlatformMessage[];
  onDismiss: (id: string) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (!messages.length) return null;

  return (
    <div className="border-b border-teal-200 bg-teal-50 px-3 py-2 dark:border-teal-900 dark:bg-teal-950/40">
      <ul className="mx-auto flex max-w-5xl flex-col gap-2">
        {messages.map((msg) => {
          const href = msg.externalUrl || '/merchant/support';
          return (
            <li key={msg.id}>
              <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-white px-3 py-2.5 shadow-sm dark:border-teal-800 dark:bg-stone-900">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                  <LifeBuoy className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    void onDismiss(msg.id);
                    if (isInternalPanelPath(href)) navigate(href);
                    else window.location.assign(href);
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    {t('supportTicketAnswered')}
                  </p>
                  <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{msg.title}</p>
                  <p className="mt-0.5 text-xs text-teal-800 dark:text-teal-200">{t('supportTicketAnsweredCta')}</p>
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  aria-label={t('dismiss')}
                  onClick={() => onDismiss(msg.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
