import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { useI18n } from '@/lib/i18n';

/** Login icon + language switcher for shop/CMS nav bars (beside hamburger). */
export default function ShopNavActions({
  accountPath,
  className = '',
  iconOnlyLogin = false,
}: {
  accountPath: string;
  className?: string;
  iconOnlyLogin?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <ShopLangSwitcher />
      <Link
        to={accountPath}
        className="inline-flex h-9 w-9 items-center justify-center border border-stone-200 bg-white text-stone-800 hover:border-stone-400 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-xs sm:font-semibold"
        aria-label={t('shopLogIn')}
        title={t('shopLogIn')}
      >
        <User className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        {iconOnlyLogin ? null : <span className="hidden sm:inline">{t('shopLogIn')}</span>}
      </Link>
    </div>
  );
}
