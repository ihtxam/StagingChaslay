import { useI18n } from '@/lib/i18n';

/** Confirmation strip when the shop is closed by hours. Does not block browsing. */
export default function ShopClosedBanner({ canPreorder = false }: { canPreorder?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="w-full bg-[#fdecec] px-4 py-2 text-center text-sm text-[#c45c4a]"
    >
      {canPreorder ? t('shopCurrentlyClosedPreorderBanner') : t('shopCurrentlyClosedBanner')}
    </div>
  );
}
