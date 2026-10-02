import { useI18n } from '@/lib/i18n';

/** Single-size pizza builder templates — MVP skeleton (modifiers linked in a future pass). */
export default function PizzaBuilderPage() {
  const { t } = useI18n();
  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{t('pizzaBuilderTitle')}</h1>
      <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderDescription')}</p>
      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">
        {t('pizzaBuilderComingSoon')}
      </div>
    </div>
  );
}
