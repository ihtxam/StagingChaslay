import { Gift, QrCode, CreditCard, Wallet, X, Mail, Printer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import RfidScanInput from '@/components/RfidScanInput';
import { useI18n } from '@/lib/i18n';
import { moneyDigitCount, normalizeMoneyInput, roundMoney2 } from '@/lib/money';
import { normalizeScannedPayload } from '@/lib/qr';
import { useModalKeyboardScroll } from '@/lib/useModalKeyboardScroll';

function normalizeRfidUid(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[\s:_\-]+/g, '')
    .toUpperCase();
}

export type GiftCardSettingsClient = {
  enabled: boolean;
  presetDenominations: number[];
  minAmount: number;
  maxAmount: number;
  reloadEnabled: boolean;
  customAmountEnabled: boolean;
};

export type GiftCardCartMeta = {
  op: 'sell' | 'reload';
  cardNumber: string;
  cardId?: string;
  mediaType: 'physical' | 'e_card';
  amount: number;
  ecardEmail?: string;
  holderName?: string;
  deliveryMethod?: 'print' | 'email' | 'both';
};

export type GiftCardPayResult = {
  cardId: string;
  cardNumber: string;
  mediaType: 'physical' | 'e_card';
  amount: number;
  balanceBefore: number;
  balanceAfter?: number;
};

type Mode = 'menu' | 'sell' | 'reload' | 'balance' | 'pay';
type MediaPick = 'choose' | 'physical' | 'e_card';
type EcardDelivery = 'print' | 'email' | 'both';

type Props = {
  open: boolean;
  mode: 'ops' | 'pay';
  settings: GiftCardSettingsClient | null;
  amountDue?: number;
  onClose: () => void;
  onAddToCart: (meta: GiftCardCartMeta, lineName: string) => void;
  onPayConfirm?: (result: GiftCardPayResult) => void;
  onAttachCustomer?: (customer: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  }) => void;
};

type LookedUpCard = {
  id: string;
  cardNumber: string;
  balance: number;
  status: string;
  membershipEnabled?: boolean;
  customerId?: string | null;
  holderName?: string | null;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

function cardHolderLabel(card: LookedUpCard): string {
  if (card.holderName?.trim()) return card.holderName.trim();
  const c = card.customer;
  if (c) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
    if (name) return name;
    if (c.email?.trim()) return c.email.trim();
    if (c.phone?.trim()) return c.phone.trim();
  }
  return '';
}

export default function WebPosGiftCardModal({
  open,
  mode,
  settings,
  amountDue = 0,
  onClose,
  onAddToCart,
  onPayConfirm,
  onAttachCustomer,
}: Props) {
  const { t } = useI18n();
  const { overlayClassName, overlayStyle, modalStyle, scrollFieldIntoView, keyboardActive, overlayFocusHandlers } =
    useModalKeyboardScroll();
  const [step, setStep] = useState<Mode>(mode === 'pay' ? 'pay' : 'menu');
  const [media, setMedia] = useState<MediaPick>(mode === 'pay' ? 'choose' : 'physical');
  const [code, setCode] = useState('');
  const [card, setCard] = useState<LookedUpCard | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [ecardEmail, setEcardEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<EcardDelivery>('print');
  const lastTriedRef = useRef('');
  const attachRef = useRef(onAttachCustomer);
  attachRef.current = onAttachCustomer;

  const lookup = useCallback(
    async (raw: string, mediaType: 'physical' | 'e_card', opts?: { silent?: boolean }) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const normalized =
        mediaType === 'physical'
          ? normalizeRfidUid(trimmed)
          : normalizeScannedPayload(trimmed);
      const lookupKey = `${mediaType}:${normalized || trimmed}`;
      setBusy(true);
      setLookupError('');
      try {
        const res = await api.get(
          `/gift-cards/lookup/${encodeURIComponent(normalized || trimmed)}`,
          { params: { mediaType } }
        );
        const c = res.data.card;
        if (c.status && c.status !== 'active') {
          throw new Error(t('webPosCardBlocked'));
        }
        const looked: LookedUpCard = {
          id: c.id,
          cardNumber: c.cardNumber,
          balance: Number(c.balance || 0),
          status: c.status,
          membershipEnabled: !!c.membershipEnabled,
          customerId: c.customerId,
          holderName: c.holderName,
          customer: c.customer
            ? {
                id: c.customer.id,
                firstName: c.customer.firstName,
                lastName: c.customer.lastName,
                email: c.customer.email,
                phone: c.customer.phone,
              }
            : null,
        };
        setCard(looked);
        setCode(looked.cardNumber || trimmed);
        lastTriedRef.current = lookupKey;
        if (looked.customer && looked.membershipEnabled && attachRef.current) {
          attachRef.current(looked.customer);
        }
        if (mode === 'pay' || step === 'pay') {
          const due = roundMoney2(amountDue);
          const apply = roundMoney2(Math.min(looked.balance, due > 0 ? due : looked.balance));
          setAmount(String(apply));
        }
      } catch (error: any) {
        setCard(null);
        lastTriedRef.current = lookupKey;
        const msg = error.response?.data?.error || t('giftCardNotFound');
        setLookupError(msg);
        // Never toast on auto-scan — that was stacking every few seconds and freezing Chrome.
        if (step !== 'sell' && !opts?.silent) {
          toast.error(msg, { id: 'gift-card-lookup' });
        }
      } finally {
        setBusy(false);
      }
    },
    [amountDue, mode, step, t]
  );

  useEffect(() => {
    if (!open) return;
    setStep(mode === 'pay' ? 'pay' : 'menu');
    setMedia(mode === 'pay' ? 'choose' : 'physical');
    setCode('');
    setCard(null);
    setAmount('');
    setCustom(false);
    setBusy(false);
    setLookupError('');
    setEcardEmail('');
    setDeliveryMethod('print');
    lastTriedRef.current = '';
  }, [open, mode]);

  useEffect(() => {
    if (!open || media === 'choose' || media === 'e_card') return;
    const trimmed = code.trim();
    if (trimmed.length < 4) return;
    const normalized = normalizeRfidUid(trimmed);
    const lookupKey = `physical:${normalized}`;
    if (card && normalizeRfidUid(card.cardNumber) === normalized) return;
    if (lastTriedRef.current === lookupKey) return;
    const tmr = window.setTimeout(() => {
      void lookup(trimmed, 'physical', { silent: true });
    }, 350);
    return () => window.clearTimeout(tmr);
    // Intentionally omit `lookup` — use latest via closure; avoid parent re-render loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, open, media, card]);

  if (!open) return null;

  const presets = settings?.presetDenominations || [20, 50, 100, 150];
  const minA = settings?.minAmount ?? 5;
  const maxA = settings?.maxAmount ?? 500;
  const reloadOk = settings?.reloadEnabled !== false;
  const customOk = settings?.customAmountEnabled !== false;
  const sellBlockedByExistingCard = step === 'sell' && !!card;

  const goToReloadForCard = () => {
    setStep('reload');
    setAmount('');
    setCustom(false);
    setLookupError('');
  };

  const clearRegisteredCard = () => {
    setCard(null);
    setCode('');
    setLookupError('');
    lastTriedRef.current = '';
  };

  const confirmSellOrReload = () => {
    const n = roundMoney2(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t('giftCardInvalidAmount'));
      return;
    }
    const skipRange = custom && customOk;
    if (!skipRange && (n < minA || n > maxA)) {
      toast.error(
        t('giftCardDenomOutOfRange')
          .replace('{min}', minA.toFixed(2))
          .replace('{max}', maxA.toFixed(2))
      );
      return;
    }
    if (moneyDigitCount(String(Math.floor(n))) > 10) {
      toast.error(t('giftCardInvalidAmount'));
      return;
    }
    const cardNumber = (card?.cardNumber || code).trim();
    const isEcard = media === 'e_card';
    if (!isEcard && !cardNumber) {
      toast.error(t('giftCardTapRequired'));
      return;
    }
    if (isEcard && step === 'sell') {
      const email = ecardEmail.trim();
      if ((deliveryMethod === 'email' || deliveryMethod === 'both') && !email.includes('@')) {
        toast.error(t('giftCardEcardEmailRequired'));
        return;
      }
    }
    if (step === 'reload') {
      if (!card) {
        toast.error(t('giftCardNotFound'));
        return;
      }
      if (!reloadOk) {
        toast.error(t('giftCardReloadDisabled'));
        return;
      }
      onAddToCart(
        {
          op: 'reload',
          cardNumber,
          cardId: card.id,
          mediaType: media === 'e_card' ? 'e_card' : 'physical',
          amount: n,
        },
        `${t('giftCardReload')} CHF ${n.toFixed(2)}`
      );
    } else {
      if (card) {
        toast.error(t('giftCardAlreadySold'));
        return;
      }
      onAddToCart(
        {
          op: 'sell',
          cardNumber: isEcard ? cardNumber : cardNumber,
          cardId: card?.id,
          mediaType: isEcard ? 'e_card' : 'physical',
          amount: n,
          ecardEmail: isEcard ? ecardEmail.trim() || undefined : undefined,
          deliveryMethod: isEcard ? deliveryMethod : undefined,
        },
        `${isEcard ? t('giftCardEcard') : t('giftCard')} CHF ${n.toFixed(2)}`
      );
    }
    onClose();
  };

  const confirmPay = () => {
    if (!card || !onPayConfirm) return;
    const n = roundMoney2(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t('giftCardInvalidAmount'));
      return;
    }
    if (n > card.balance + 0.001) {
      toast.error(t('giftCardInsufficient'));
      return;
    }
    onPayConfirm({
      cardId: card.id,
      cardNumber: card.cardNumber,
      mediaType: media === 'e_card' ? 'e_card' : 'physical',
      amount: n,
      balanceBefore: card.balance,
      balanceAfter: roundMoney2(Math.max(0, card.balance - n)),
    });
    onClose();
  };

  return (
    <div
      className={`fixed inset-x-0 z-[80] flex justify-center overflow-y-auto bg-black/40 p-3 sm:p-4 ${
        keyboardActive ? '' : 'inset-y-0'
      } ${overlayClassName}`}
      style={overlayStyle}
      {...overlayFocusHandlers}
    >
      <div
        className={`my-auto flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${
          step === 'menu' ? 'max-w-xl' : 'max-w-md'
        }`}
        style={modalStyle}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <Gift size={20} className="text-teal-600" />
            {mode === 'pay' ? t('giftCardPay') : t('giftCard')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {step === 'menu' && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-[320px]:grid-cols-1">
              <button
                type="button"
                className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border border-stone-200 px-2 py-4 text-center text-sm font-semibold hover:border-teal-200 hover:bg-teal-50 active:scale-[0.98]"
                onClick={() => {
                  setStep('sell');
                  setMedia('choose');
                }}
              >
                <Gift size={24} className="shrink-0 text-teal-600" />
                <span className="leading-tight">{t('giftCardSell')}</span>
              </button>
              <button
                type="button"
                disabled={!reloadOk}
                className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border border-stone-200 px-2 py-4 text-center text-sm font-semibold hover:border-teal-200 hover:bg-teal-50 active:scale-[0.98] disabled:opacity-40"
                onClick={() => {
                  setStep('reload');
                  setMedia('physical');
                }}
              >
                <CreditCard size={24} className="shrink-0 text-teal-600" />
                <span className="leading-tight">{t('giftCardReload')}</span>
              </button>
              <button
                type="button"
                className="flex min-h-12 touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border border-stone-200 px-2 py-4 text-center text-sm font-semibold hover:border-teal-200 hover:bg-teal-50 active:scale-[0.98]"
                onClick={() => {
                  setStep('balance');
                  setMedia('physical');
                }}
              >
                <Wallet size={24} className="shrink-0 text-teal-600" />
                <span className="leading-tight">{t('giftCardCheckBalance')}</span>
              </button>
            </div>
          )}

          {(step === 'pay' || mode === 'pay') && media === 'choose' && (
            <div className="grid gap-2">
              <p className="text-sm text-stone-600">{t('giftCardChooseMedia')}</p>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 font-semibold hover:bg-teal-50"
                onClick={() => setMedia('physical')}
              >
                <CreditCard size={20} /> {t('giftCardPhysical')}
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 font-semibold hover:bg-teal-50"
                onClick={() => setMedia('e_card')}
              >
                <QrCode size={20} /> {t('giftCardEcard')}
              </button>
            </div>
          )}

          {step === 'sell' && media === 'choose' && (
            <div className="grid gap-2">
              <p className="text-sm text-stone-600">{t('giftCardSellChooseMedia')}</p>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 font-semibold hover:bg-teal-50"
                onClick={() => setMedia('physical')}
              >
                <CreditCard size={20} /> {t('giftCardPhysical')}
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 font-semibold hover:bg-teal-50"
                onClick={() => setMedia('e_card')}
              >
                <QrCode size={20} /> {t('giftCardEcard')}
              </button>
            </div>
          )}

          {step !== 'menu' && media !== 'choose' && (
            <>
              <div>
                {media === 'e_card' && step === 'sell' ? (
                  <>
                    <p className="mb-3 text-sm text-stone-600">{t('giftCardEcardSellHint')}</p>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {t('giftCardEcardDelivery')}
                    </label>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {(
                        [
                          ['print', Printer, t('giftCardEcardDeliveryPrint')],
                          ['email', Mail, t('giftCardEcardDeliveryEmail')],
                          ['both', Gift, t('giftCardEcardDeliveryBoth')],
                        ] as const
                      ).map(([key, Icon, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold ${
                            deliveryMethod === key
                              ? 'border-teal-500 bg-teal-50 text-teal-800'
                              : 'border-stone-200 hover:bg-stone-50'
                          }`}
                          onClick={() => setDeliveryMethod(key)}
                        >
                          <Icon size={18} />
                          {label}
                        </button>
                      ))}
                    </div>
                    {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                      <label className="block text-sm">
                        <span className="text-stone-600">{t('giftCardEcardRecipientEmail')}</span>
                        <input
                          className="input mt-1 w-full"
                          type="email"
                          autoFocus
                          value={ecardEmail}
                          placeholder="name@example.com"
                          onChange={(e) => setEcardEmail(e.target.value)}
                          onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {media === 'e_card' ? t('giftCardScanOrPasteCode') : t('tapCard')}
                </label>
                {media === 'e_card' ? (
                  <RfidScanInput
                    value={code}
                    onChange={(v) => {
                      lastTriedRef.current = '';
                      setLookupError('');
                      setCode(v);
                    }}
                    onScanComplete={(scanned) => {
                      lastTriedRef.current = '';
                      setLookupError('');
                      const parsed = normalizeScannedPayload(scanned);
                      setCode(parsed || scanned);
                      void lookup(parsed || scanned, 'e_card', { silent: false });
                    }}
                    placeholder={t('giftCardEcardPlaceholder')}
                    autoFocus
                    className="input w-full"
                  />
                ) : (
                  <RfidScanInput
                    value={code}
                    onChange={(v) => {
                      lastTriedRef.current = '';
                      setLookupError('');
                      setCode(v);
                    }}
                    onScanComplete={(scanned) => {
                      lastTriedRef.current = '';
                      setLookupError('');
                      setCode(scanned);
                      void lookup(scanned, 'physical', {
                        silent: step === 'sell' || step === 'balance',
                      });
                    }}
                    placeholder={t('tapCard')}
                    autoFocus
                    className="input w-full"
                  />
                )}
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-teal-700 disabled:opacity-40"
                  disabled={busy || code.trim().length < 4}
                  onClick={() =>
                    void lookup(code, media === 'e_card' ? 'e_card' : 'physical', {
                      silent: false,
                    })
                  }
                >
                  {t('giftCardLookup')}
                </button>
                  </>
                )}
                {lookupError ? (
                  <p className="mt-2 text-sm font-medium text-red-600">{lookupError}</p>
                ) : null}
              </div>

              {card && (
                <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  <div className="font-mono text-xs">{card.cardNumber}</div>
                  <div className="mt-1 text-lg font-bold">CHF {card.balance.toFixed(2)}</div>
                  {card.membershipEnabled && (
                    <div className="mt-1 text-xs">
                      {t('membership')}: {cardHolderLabel(card) || '-'}
                    </div>
                  )}
                </div>
              )}

              {sellBlockedByExistingCard && (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-950">{t('giftCardAlreadySoldTitle')}</p>
                  <p className="text-sm text-amber-900">
                    {t('giftCardAlreadySoldMessage').replace(
                      '{name}',
                      cardHolderLabel(card!) || t('giftCardUnknownHolder')
                    )}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={clearRegisteredCard}
                    >
                      {t('giftCardUseDifferentCard')}
                    </button>
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      disabled={!reloadOk}
                      onClick={goToReloadForCard}
                    >
                      {t('giftCardRechargeThisCard')}
                    </button>
                  </div>
                  {!reloadOk ? (
                    <p className="text-xs text-amber-800">{t('giftCardReloadDisabled')}</p>
                  ) : null}
                </div>
              )}

              {step === 'balance' && card && (
                <button type="button" className="btn-primary w-full" onClick={onClose}>
                  {t('close')}
                </button>
              )}

              {(step === 'reload' || (step === 'sell' && !card)) &&
                (media === 'e_card' && step === 'sell' || code || card) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setAmount(String(p));
                          setCustom(false);
                        }}
                        className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                          Number(amount) === p
                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        CHF {p.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  {customOk && (
                    <>
                      <button
                        type="button"
                        className="text-sm font-semibold text-teal-700"
                        onClick={() => setCustom(true)}
                      >
                        {t('giftCardCustomAmount')}
                      </button>
                      {custom && (
                        <input
                          className="input w-full"
                          type="text"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => {
                            const next = normalizeMoneyInput(e.target.value);
                            const intPart = next.split('.')[0] || '';
                            if (moneyDigitCount(intPart) > 10) return;
                            setAmount(next);
                          }}
                          placeholder={t('giftCardCustomAmount')}
                          onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                        />
                      )}
                    </>
                  )}
                  {!custom && amount && (
                    <p className="text-sm text-stone-600">
                      {t('giftCardSelectedAmount')}: CHF {Number(amount).toFixed(2)}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy || !amount}
                    onClick={confirmSellOrReload}
                  >
                    {t('giftCardAddToCart')}
                  </button>
                </div>
              )}

              {mode === 'pay' && media !== 'choose' && card && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="text-stone-600">{t('giftCardPayAmount')}</span>
                    <input
                      className="input mt-1 w-full"
                      type="number"
                      min="0.01"
                      max={card.balance}
                      step="0.01"
                      onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  {amountDue > card.balance && (
                    <p className="text-xs text-amber-700">
                      {t('giftCardPartialHint')
                        .replace('{balance}', card.balance.toFixed(2))
                        .replace('{due}', amountDue.toFixed(2))}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy}
                    onClick={confirmPay}
                  >
                    {t('giftCardApplyPayment')}
                  </button>
                </div>
              )}

              {step === 'sell' && !card && code && media !== 'e_card' && (
                <p className="text-xs text-stone-500">{t('giftCardNewCardHint')}</p>
              )}
              {step === 'sell' && media === 'e_card' && (
                <p className="text-xs text-stone-500">{t('giftCardEcardNewHint')}</p>
              )}
            </>
          )}

          {step !== 'menu' && mode !== 'pay' && (
            <button
              type="button"
              className="text-sm text-stone-500 hover:underline"
              onClick={() => {
                setStep('menu');
                setMedia('physical');
                setCard(null);
                setCode('');
                setAmount('');
              }}
            >
              {t('back')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
