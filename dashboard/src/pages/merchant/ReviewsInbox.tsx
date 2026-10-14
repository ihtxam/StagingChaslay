import GoogleReputationPanel from '@/components/growth/GoogleReputationPanel';
import { useI18n } from '@/lib/i18n';

/** Owner.com-style review inbox — list + reply drafts. */
export default function ReviewsInbox() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('reviewsInboxNav')}</h1>
        <p className="text-sm text-[var(--text-muted)]">{t('shopReviewAskTitle')}</p>
      </div>
      <GoogleReputationPanel />
    </div>
  );
}
