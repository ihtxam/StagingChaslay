import { Link } from 'react-router-dom';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function ShopFloatingActions({
  basePath,
  showReservations = false,
}: {
  basePath: string;
  showReservations?: boolean;
}) {
  const { t } = useI18n();
  const reservationsPath = `${basePath}/reservations`;
  const menuPath = `${basePath}/menu`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
      <div
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md"
        style={{
          borderColor: 'var(--color-border-default, rgb(231 229 228))',
          background: 'color-mix(in srgb, var(--color-bg-0, #ffffff) 88%, transparent)',
        }}
      >
        {showReservations ? (
          <Link
            to={reservationsPath}
            className="shop-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold"
          >
            <CalendarDays size={14} />
            {t('shopReservations')}
          </Link>
        ) : null}
        <Link
          to={menuPath}
          className="shop-btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs font-bold"
        >
          <ShoppingBag size={14} />
          {t('shopOrderNow')}
        </Link>
      </div>
    </div>
  );
}
