import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import CdsPromoSlider from '@/components/customer-display/CdsPromoSlider';
import {
  isCustomerDisplayLocale,
  persistCdsLocale,
  requestCustomerDisplayState,
  subscribeCustomerDisplayState,
  type CustomerDisplayState,
} from '@/lib/customer-display-sync';
import type { KioskPromoSlide } from '@/lib/kiosk-api';
import { useI18n } from '@/lib/i18n';
import { formatCHF } from '@/lib/money';
import { qrImageUrl } from '@/lib/qr';

type CdsConfig = {
  merchant: { name: string; logoUrl?: string | null };
  settings: {
    promoSlides: KioskPromoSlide[];
    slideIntervalSec: number;
    theme: 'light' | 'dark';
    syncToken?: string;
  };
};

const IDLE_STATE: CustomerDisplayState = {
  currency: 'CHF',
  lines: [],
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  phase: 'idle',
  updatedAt: 0,
};

function money(currency: string, amount: number): string {
  if (currency === 'CHF') return formatCHF(amount);
  return `${currency} ${amount.toFixed(2)}`;
}

export default function CustomerDisplayPage() {
  const { token = '' } = useParams();
  const { t, locale, setLocale } = useI18n();
  const [config, setConfig] = useState<CdsConfig | null>(null);
  const [syncToken, setSyncToken] = useState('');
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CustomerDisplayState>(IDLE_STATE);

  const applyPosLocale = useCallback(
    (next: unknown) => {
      if (!isCustomerDisplayLocale(next)) return;
      if (next === locale) {
        persistCdsLocale(next);
        return;
      }
      setLocale(next);
      persistCdsLocale(next);
    },
    [locale, setLocale]
  );

  const loadConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/cds/${encodeURIComponent(token)}/config`);
      setConfig({
        merchant: res.data.merchant,
        settings: res.data.settings,
      });
      setSyncToken(String(res.data.settings?.syncToken || token).trim());
      setError('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || t('cdsLoadFailed'));
    }
  }, [token, t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const channelToken = syncToken || token;
    if (!channelToken) return;
    const unsubscribe = subscribeCustomerDisplayState(channelToken, (state) => {
      setCart(state);
      applyPosLocale(state.locale);
    });
    // Ask POS for the latest cart + locale on connect / refresh.
    requestCustomerDisplayState(channelToken);
    const retry = window.setTimeout(() => requestCustomerDisplayState(channelToken), 400);
    return () => {
      unsubscribe();
      window.clearTimeout(retry);
    };
  }, [syncToken, token, applyPosLocale]);

  const theme = config?.settings.theme === 'dark' ? 'dark' : 'light';
  const hasLines = cart.lines.length > 0;
  const phase = cart.phase;
  const merchantName = cart.merchantName || config?.merchant.name || '';
  const showThankYou = phase === 'thankyou';

  const pageClass =
    theme === 'dark'
      ? 'bg-slate-950 text-white'
      : 'bg-slate-100 text-slate-900';

  const cardClass =
    theme === 'dark'
      ? 'bg-slate-900/80 border-slate-800'
      : 'bg-white border-slate-200';

  const slides = config?.settings.promoSlides || [];

  const headline = useMemo(() => {
    if (showThankYou) return t('cdsThankYouTitle');
    if (phase === 'payment') return t('cdsPaymentTitle');
    if (hasLines) return t('cdsYourOrder');
    return merchantName;
  }, [showThankYou, phase, hasLines, merchantName, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-white">
        <p className="text-xl font-semibold">{error}</p>
      </div>
    );
  }

  if (showThankYou) {
    const receiptUrl = cart.receiptUrl?.trim();
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center p-6 md:p-10 ${pageClass}`}>
        {config?.merchant.logoUrl ? (
          <img
            src={config.merchant.logoUrl}
            alt=""
            className="mb-6 h-14 w-auto object-contain"
          />
        ) : null}
        <div className={`w-full max-w-lg rounded-2xl border p-8 text-center shadow-sm ${cardClass}`}>
          <h1 className="text-3xl font-bold md:text-4xl">{headline}</h1>
          <p className="mt-2 text-lg opacity-80">{t('cdsThankYouSubtitle')}</p>
          {receiptUrl ? (
            <div className="mt-8 flex flex-col items-center gap-4">
              <img
                src={qrImageUrl(receiptUrl, 220)}
                alt=""
                className="rounded-xl border border-inherit bg-white p-3"
                width={220}
                height={220}
              />
              <p className="text-sm opacity-70">{t('cdsReceiptQrHint')}</p>
            </div>
          ) : null}
          {cart.total > 0 ? (
            <p className="mt-6 text-2xl font-black tabular-nums text-teal-600">
              {money(cart.currency, cart.total)}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${pageClass}`}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col p-4 md:p-6 lg:flex-row lg:gap-6">
        <section
          className={`${hasLines ? 'lg:w-[35%]' : 'lg:w-full'} flex shrink-0 flex-col gap-4`}
        >
          {config?.merchant.logoUrl ? (
            <img
              src={config.merchant.logoUrl}
              alt=""
              className="h-12 w-auto object-contain self-start"
            />
          ) : null}
          <CdsPromoSlider
            slides={slides}
            intervalSec={config?.settings.slideIntervalSec || 8}
            merchantName={merchantName}
            fullWidth={!hasLines}
            className="flex-1"
          />
        </section>

        {hasLines || phase === 'payment' ? (
          <section className="flex min-h-0 flex-1 flex-col lg:w-[65%]">
            <div className={`flex h-full flex-col rounded-2xl border shadow-sm ${cardClass}`}>
              <header className="border-b border-inherit px-6 py-5">
                <h1 className="text-2xl font-bold md:text-3xl">{headline}</h1>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <ul className="space-y-3">
                  {cart.lines.map((line, idx) => (
                    <li
                      key={`${line.name}-${idx}`}
                      className="flex items-start justify-between gap-4 border-b border-inherit/40 pb-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-lg font-semibold leading-snug md:text-xl">
                          <span className="mr-2 tabular-nums opacity-70">{line.qty}×</span>
                          {line.name}
                        </p>
                        {line.modifiers ? (
                          <p className="mt-0.5 text-sm opacity-70 md:text-base">{line.modifiers}</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-lg font-bold tabular-nums md:text-xl">
                        {money(cart.currency, line.lineTotal)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <footer className="border-t border-inherit px-6 py-5">
                <div className="space-y-1 text-base md:text-lg">
                  {cart.discount > 0 ? (
                    <div className="flex justify-between opacity-80">
                      <span>{t('cdsDiscount')}</span>
                      <span className="tabular-nums">−{money(cart.currency, cart.discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between opacity-80">
                    <span>{t('cdsSubtotal')}</span>
                    <span className="tabular-nums">{money(cart.currency, cart.subtotal)}</span>
                  </div>
                  {cart.tax > 0 ? (
                    <div className="flex justify-between opacity-80">
                      <span>{t('cdsTax')}</span>
                      <span className="tabular-nums">{money(cart.currency, cart.tax)}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-inherit pt-4">
                  <span className="text-xl font-bold md:text-2xl">{t('cdsTotal')}</span>
                  <span className="text-3xl font-black tabular-nums text-teal-600 md:text-4xl">
                    {money(cart.currency, cart.total)}
                  </span>
                </div>
              </footer>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
