import { useI18n } from '@/lib/i18n';

export default function HqCatalogBadge({ fromHq }: { fromHq?: boolean }) {
  const { t } = useI18n();
  if (!fromHq) return null;
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
      {t('hqFromHqBadge')}
    </span>
  );
}
