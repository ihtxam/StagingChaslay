import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import CdsPromoSlider from '@/components/customer-display/CdsPromoSlider';
import {
  subscribeCustomerDisplayState,
  type CustomerDisplayState,
} from '@/lib/customer-display-sync';
import type { KioskPromoSlide } from '@/lib/kiosk-api';
import { formatCHF } from '@/lib/money';

type CdsConfig = {
  merchant: { name: string; logoUrl?: string | null };
  settings: {
    promoSlides: KioskPromoSlide[];
    slideIntervalSec: number;
    theme: 'light' | 'dark';
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
  const [config, setConfig] = useState<CdsConfig | null>(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CustomerDisplayState>(IDLE_STATE);

  const loadConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/cds/${encodeURIComponent(token)}/config`);
      setConfig({
        merchant: res.data.merchant,
        settings: res.data.settings,
      });
      setError('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Customer display not available');
    }
  }, [token]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!token) return;
    return subscribeCustomerDisplayState(token, (state) => {
      setCart(state);
    });
  }, [token]);

  const theme = config?.settings.theme === 'dark' ? 'dark' : 'light';
  const hasLines = cart.lines.length > 0;
  const phase = cart.phase;
  const merchantName = cart.merchantName || config?.merchant.name || '';

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
    if (phase === 'thankyou') return 'Thank you!';
    if (phase === 'payment') return 'Please complete payment';
    if (hasLines) return 'Your order';
    return merchantName;
  }, [phase, hasLines, merchantName]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-white">
        <p className="text-xl font-semibold">{error}</p>
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

        {hasLines || phase === 'payment' || phase === 'thankyou' ? (
          <section className="flex min-h-0 flex-1 flex-col lg:w-[65%]">
            <div className={`flex h-full flex-col rounded-2xl border shadow-sm ${cardClass}`}>
              <header className="border-b border-inherit px-6 py-5">
                <h1 className="text-2xl font-bold md:text-3xl">{headline}</h1>
                {phase === 'thankyou' ? (
                  <p className="mt-1 text-base opacity-80">See you again soon</p>
                ) : null}
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
                      <span>Discount</span>
                      <span className="tabular-nums">−{money(cart.currency, cart.discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between opacity-80">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{money(cart.currency, cart.subtotal)}</span>
                  </div>
                  {cart.tax > 0 ? (
                    <div className="flex justify-between opacity-80">
                      <span>Tax</span>
                      <span className="tabular-nums">{money(cart.currency, cart.tax)}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-inherit pt-4">
                  <span className="text-xl font-bold md:text-2xl">Total</span>
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
