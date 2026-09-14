import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

type Props = {
  merchantName?: string;
  logoUrl?: string | null;
  backHref: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function ShopAuthShell({
  merchantName,
  logoUrl,
  backHref,
  title,
  subtitle,
  children,
  footer,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="min-h-[calc(100dvh-10rem)] flex flex-col items-center justify-center px-4 py-10 bg-[#FAF8F5]">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-14 w-auto max-w-[12rem] object-contain mb-3" />
      ) : merchantName ? (
        <p className="text-lg font-bold text-stone-900 mb-3">{merchantName}</p>
      ) : null}
      <Link
        to={backHref}
        className="text-sm font-medium text-stone-600 hover:text-stone-900 mb-4"
      >
        ← {t('shopBackToMenu')}
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-center text-stone-900">{title}</h1>
      {subtitle ? <p className="mt-2 mb-6 text-center text-stone-500">{subtitle}</p> : <div className="mb-6" />}
      <div className="w-full max-w-md rounded-2xl border border-stone-100 bg-white p-6 shadow-lg shadow-stone-200/60">
        {children}
      </div>
      {footer ? <div className="mt-5 text-center text-sm text-stone-500">{footer}</div> : null}
    </div>
  );
}
