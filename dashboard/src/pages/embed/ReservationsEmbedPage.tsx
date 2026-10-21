import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import DelicateReservationsForm from '@/components/shop/DelicateReservationsForm';
import { resolveShopKey } from '@/lib/shop-cart';
import { I18nProvider, SHOP_LANG_KEY, isLocale, type Locale } from '@/lib/i18n';

export default function ReservationsEmbedPage() {
  const { merchantSlug } = useParams<{ merchantSlug: string }>();
  const [params] = useSearchParams();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const accent = params.get('accent') || undefined;
  const title = params.get('title') || undefined;
  const langParam = params.get('lang') || 'fr';
  const initialLocale: Locale | undefined = isLocale(langParam) ? langParam : 'fr';

  const notifyParent = useCallback((type: string, payload?: Record<string, string>) => {
    try {
      window.parent?.postMessage({ source: 'reborn-reservations', type, ...payload }, '*');
    } catch {
      /* cross-origin */
    }
  }, []);

  const onClose = useCallback(() => notifyParent('close'), [notifyParent]);
  const onSuccess = useCallback(
    (p: { code: string; status: string }) => {
      notifyParent('success', { code: p.code, status: p.status });
    },
    [notifyParent]
  );

  return (
    <I18nProvider storageKey={`${SHOP_LANG_KEY}_${shopKey}`} initialLocale={initialLocale}>
      <link rel="stylesheet" href="/embed/delicate-reservations.css" />
      <DelicateReservationsForm
        shopKey={shopKey}
        theme={theme}
        accent={accent}
        title={title}
        showClose
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </I18nProvider>
  );
}
