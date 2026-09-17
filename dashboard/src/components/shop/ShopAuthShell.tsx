type Props = {
  merchantName?: string;
  logoUrl?: string | null;
  backHref?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function ShopAuthShell({
  merchantName,
  logoUrl,
  title,
  subtitle,
  children,
  footer,
}: Props) {
  return (
    <div className="min-h-[calc(100dvh-10rem)] flex flex-col items-center justify-center px-4 py-10 bg-[#FAF8F5]">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="mb-3 h-14 w-14 rounded-full object-cover" />
      ) : merchantName ? (
        <p className="mb-3 text-lg font-bold text-stone-900">{merchantName}</p>
      ) : null}
      <h1 className="text-center text-2xl font-bold text-stone-900 sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-2 mb-6 text-center text-stone-500">{subtitle}</p> : <div className="mb-6" />}
      <div className="w-full max-w-md rounded-2xl border border-stone-100 bg-white p-6 shadow-lg shadow-stone-200/60">
        {children}
      </div>
      {footer ? <div className="mt-5 text-center text-sm text-stone-500">{footer}</div> : null}
    </div>
  );
}
