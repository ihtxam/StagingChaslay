import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { clearCart } from '@/lib/shop-cart';
import {
  adyenLocaleFor,
  formatAdyenError,
  mountAdyenDropin,
  normalizeAdyenPaymentSession,
  type AdyenPaymentSession,
} from '@/lib/adyen-checkout';

type Props = {
  open: boolean;
  shopKey: string;
  orderId: string;
  total: number;
  session: AdyenPaymentSession | null;
  demoMode?: boolean;
  demoError?: string;
  onClose: () => void;
  onPaid: () => void;
};

export default function ShopPaymentModal({
  open,
  shopKey,
  orderId,
  total,
  session,
  demoMode,
  demoError,
  onClose,
  onPaid,
}: Props) {
  const { t, locale } = useI18n();
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);
  const [payMsg, setPayMsg] = useState('');
  const sessionId = session?.id || '';
  const sessionData = session?.sessionData || '';
  const clientKey = session?.clientKey || '';
  const normalized = normalizeAdyenPaymentSession(session);

  useEffect(() => {
    if (!open) {
      dropinMounted.current = false;
      setPayMsg('');
      setDropinEl(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || demoMode || !normalized || !dropinEl || dropinMounted.current) return;
    let cancelled = false;

    void (async () => {
      try {
        await mountAdyenDropin({
          session: normalized,
          container: dropinEl,
          locale: adyenLocaleFor(locale),
          credentialSource: 'merchant',
          onPaymentCompleted: async (result) => {
            if (cancelled) return;
            setPayMsg(t('shopPaymentCompleted'));
            await axios.post(`/api/shop/${shopKey}/orders/${orderId}/confirm-payment`, {
              resultCode: result?.resultCode || 'Authorised',
            });
            sessionStorage.removeItem(`manupos_pay_${orderId}`);
            clearCart(shopKey);
            onPaid();
          },
          onError: (err) => {
            if (!cancelled) {
              setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopPaymentFailed'));
            }
          },
        });
        if (!cancelled) dropinMounted.current = true;
      } catch (err) {
        if (!cancelled) {
          setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopCardFormUnavailable'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, demoMode, sessionId, sessionData, clientKey, dropinEl, shopKey, orderId, onPaid, t, locale]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label={t('shopClose')} onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-lg font-bold">{t('shopFinalizePayment')}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-center text-3xl font-bold tabular-nums mb-4">CHF {total.toFixed(2)}</p>
          {demoMode || !normalized ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-800">{demoError || t('shopCardNotConfigured')}</p>
              <button
                type="button"
                className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white"
                onClick={async () => {
                  await axios.post(`/api/shop/${shopKey}/orders/${orderId}/confirm-payment`, {
                    resultCode: 'Authorised',
                    demo: true,
                  });
                  clearCart(shopKey);
                  onPaid();
                }}
              >
                {t('shopDemoPayConfirm')}
              </button>
            </div>
          ) : (
            <div ref={setDropinEl} />
          )}
          {payMsg ? <p className="mt-3 text-sm text-stone-600">{payMsg}</p> : null}
        </div>
      </div>
    </div>
  );
}
