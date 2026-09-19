import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { useI18n } from '@/lib/i18n';

export default function ShopTopBarActions({
  accountPath,
  className = '',
  loggedIn = false,
}: {
  accountPath: string;
  className?: string;
  loggedIn?: boolean;
}) {
  const { t } = useI18n();
  const label = loggedIn ? t('shopMyAccount') : t('shopLogIn');

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <ShopLangSwitcher />
      <Link
        to={accountPath}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 sm:px-3"
        aria-label={label}
      >
        <User className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{label}</span>
      </Link>
    </div>
  );
}
