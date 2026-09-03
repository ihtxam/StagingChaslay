import toast from 'react-hot-toast';
import { Copy, ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { filterMerchantShopUrl } from '@/lib/shop-public-urls';

type ShopPublicLinksProps = {
  shopPathUrl?: string | null;
  shopMenuUrl?: string | null;
  shopPanelPathUrl?: string | null;
  shopSubdomainUrl?: string | null;
  shopCustomDomainUrl?: string | null;
  className?: string;
};

function copyUrl(url: string, t: (key: string) => string) {
  void navigator.clipboard.writeText(url).then(
    () => toast.success(t('copied')),
    () => toast.error(t('copyFailed'))
  );
}

function ShopLinkRow({
  label,
  url,
  t,
}: {
  label: string;
  url: string;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-stone-700">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          className="text-sm text-teal-700 underline break-all"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          {url}
        </a>
        <a
          className="inline-flex shrink-0 items-center text-teal-700"
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          className="btn-secondary shrink-0 px-2 py-1"
          aria-label={t('copied')}
          onClick={() => copyUrl(url, t)}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Clickable public shop URLs for merchant settings (homepage, menu, panel path). */
export default function ShopPublicLinks({
  shopPathUrl,
  shopMenuUrl,
  shopPanelPathUrl,
  shopSubdomainUrl,
  shopCustomDomainUrl,
  className,
}: ShopPublicLinksProps) {
  const { t } = useI18n();
  const websiteUrl = filterMerchantShopUrl(shopPathUrl);
  const menuUrl = filterMerchantShopUrl(shopMenuUrl);
  const panelUrl = filterMerchantShopUrl(shopPanelPathUrl);
  const subdomainUrl = filterMerchantShopUrl(shopSubdomainUrl);
  const customDomainUrl = filterMerchantShopUrl(shopCustomDomainUrl);
  const hasLinks = websiteUrl || menuUrl || panelUrl || subdomainUrl || customDomainUrl;
  if (!hasLinks) return null;

  return (
    <div
      className={`rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-3 ${className || ''}`}
    >
      <p className="text-sm font-medium">{t('shopPublicLinksTitle')}</p>
      <p className="text-xs muted">{t('shopPublicLinksHint')}</p>
      {websiteUrl ? <ShopLinkRow label={t('shopWebsiteLink')} url={websiteUrl} t={t} /> : null}
      {menuUrl ? <ShopLinkRow label={t('shopMenuLink')} url={menuUrl} t={t} /> : null}
      {panelUrl ? (
        <ShopLinkRow label={t('shopPanelPathLink')} url={panelUrl} t={t} />
      ) : null}
      {subdomainUrl ? (
        <ShopLinkRow label={t('shopSubdomainLink')} url={subdomainUrl} t={t} />
      ) : null}
      {customDomainUrl ? (
        <ShopLinkRow label={t('shopCustomDomainLink')} url={customDomainUrl} t={t} />
      ) : null}
    </div>
  );
}
