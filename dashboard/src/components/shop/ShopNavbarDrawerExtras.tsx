import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { useI18n } from '@/lib/i18n';

/** Login / Account + language controls for shop navbar mobile drawer. */
export default function ShopNavbarDrawerExtras({
  accountPath,
  textColor = '#1a1a2e',
  loggedIn = false,
}: {
  accountPath: string;
  textColor?: string;
  loggedIn?: boolean;
}) {
  const { t } = useI18n();
  const label = loggedIn ? t('shopMyAccount') : t('shopLogIn');

  return (
    <div
      className="shop-navbar-drawer-extras border-t border-stone-200/80 pt-3 mt-1"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <ShopLangSwitcher className="justify-start" />
      <Link
        to={accountPath}
        className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80"
        style={{ color: textColor, textDecoration: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <User className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        {label}
      </Link>
    </div>
  );
}
