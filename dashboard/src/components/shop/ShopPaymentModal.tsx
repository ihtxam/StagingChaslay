import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AlertCircle, Ban, RotateCcw, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { clearCart } from '@/lib/shop-cart';
import {
  adyenLocaleFor,
  formatAdyenError,
  isAdyenPaymentSuccess,
  mountAdyenDropin,
  normalizeAdyenPaymentSession,
  type AdyenPaymentSession,
} from '@/lib/adyen-checkout';

type PaymentPhase = 'paying' | 'cancelled' | 'failed';

type Props = {
  open: boolean;
  shopKey: string;
  orderId: string;
  total: number;
  session: AdyenPaymentSession | null;
  demoMode?: boolean;
  demoError?: string;
  onAbandon: () => void;
  onPaid: () => void;
  onRefreshSession?: () => Promise<AdyenPaymentSession | null>;
};

export default function ShopPaymentModal({
  open,
  shopKey,
  orderId,
  total,
  session,
  demoMode,
  demoError,
  onAbandon,
  onPaid,
  onRefreshSession,
}: Props) {
  const { t, locale } = useI18n();
  const [dropinEl, setDropinEl] = useState<HTMLDivElement | null>(null);
  const dropinMounted = useRef(false);
  const [payMsg, setPayMsg] = useState('');
  const [phase, setPhase] = useState<PaymentPhase>('paying');
  const [mountKey, setMountKey] = useState(0);
  const sessionId = session?.id || '';
  const sessionData = session?.sessionData || '';
  const clientKey = session?.clientKey || '';
  const normalized = normalizeAdyenPaymentSession(session);

  const resetDropin = useCallback(() => {
    dropinMounted.current = false;
    setDropinEl(null);
    setPayMsg('');
    setPhase('paying');
    setMountKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!open) {
      resetDropin();
    }
  }, [open, resetDropin]);

  useEffect(() => {
    if (!open || demoMode || phase !== 'paying' || !normalized || !dropinEl || dropinMounted.current) return;
    let cancelled = false;

    void (async () => {
      try {
        await mountAdyenDropin({
          session: normalized,
          container: dropinEl,
          locale: adyenLocaleFor(locale),
          credentialSource: 'merchant',
          onPaymentCompleted: async (result) => {
            if (cancelled || !isAdyenPaymentSuccess(result?.resultCode)) return;
            setPayMsg(t('shopPaymentCompleted'));
            await axios.post(`/api/shop/${shopKey}/orders/${orderId}/confirm-payment`, {
              resultCode: result?.resultCode || 'Authorised',
              paymentMethod: result?.paymentMethod,
              pspReference: (result as { pspReference?: string }).pspReference,
            });
            sessionStorage.removeItem(`manupos_pay_${orderId}`);
            clearCart(shopKey);
            onPaid();
          },
          onPaymentFailed: (result) => {
            if (cancelled) return;
            const code = String(result?.resultCode || '').toLowerCase();
            setPhase(code === 'cancelled' ? 'cancelled' : 'failed');
            setPayMsg('');
          },
          onError: (err) => {
            if (!cancelled) {
              setPhase('failed');
              setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopPaymentFailed'));
            }
          },
        });
        if (!cancelled) dropinMounted.current = true;
      } catch (err) {
        if (!cancelled) {
          setPhase('failed');
          setPayMsg(formatAdyenError(err, 'dropin', 'merchant') || t('shopCardFormUnavailable'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    demoMode,
    phase,
    mountKey,
    sessionId,
    sessionData,
    clientKey,
    dropinEl,
    shopKey,
    orderId,
    onPaid,
    t,
    locale,
    normalized,
  ]);

  const handleRetry = async () => {
    resetDropin();
    if (onRefreshSession) {
      await onRefreshSession();
    }
  };

  if (!open) return null;

  const showTerminal = phase === 'cancelled' || phase === 'failed';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label={t('shopClose')}
        onClick={() => {
          if (showTerminal) onAbandon();
          else setPhase('cancelled');
        }}
      />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-lg font-bold">
            {showTerminal
              ? phase === 'cancelled'
                ? t('shopPaymentCancelled')
                : t('shopPaymentFailedTitle')
              : t('shopFinalizePayment')}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (showTerminal) onAbandon();
              else setPhase('cancelled');
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-center text-3xl font-bold tabular-nums mb-4">CHF {total.toFixed(2)}</p>

          {showTerminal ? (
            <div className="flex flex-col items-center text-center">
              {phase === 'cancelled' ? (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <Ban className="h-8 w-8" aria-hidden />
                </div>
              ) : (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-700">
                  <AlertCircle className="h-8 w-8" aria-hidden />
                </div>
              )}
              <p className="text-sm text-stone-600">
                {phase === 'cancelled' ? t('shopPaymentCancelledMsg') : payMsg || t('shopPaymentFailedMsg')}
              </p>
              <div className="mt-6 flex w-full flex-col gap-3">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 text-sm font-semibold hover:bg-stone-50"
                  onClick={() => void handleRetry()}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('shopRetryPayment')}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white"
                  onClick={onAbandon}
                >
                  {t('shopBackToCheckout')}
                </button>
              </div>
            </div>
          ) : demoMode || !normalized ? (
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

          {!showTerminal && payMsg ? <p className="mt-3 text-sm text-stone-600">{payMsg}</p> : null}
        </div>
      </div>
    </div>
  );
}
