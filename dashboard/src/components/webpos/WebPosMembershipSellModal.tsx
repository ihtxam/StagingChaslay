import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, X } from 'lucide-react';
import api from '@/lib/api';
import RfidScanInput from '@/components/RfidScanInput';
import { useI18n } from '@/lib/i18n';
import { useModalKeyboardScroll } from '@/lib/useModalKeyboardScroll';
import type { MembershipPlan } from '@/lib/membership-plans';
import type { AttachedMembership } from '@/lib/loyalty-math';
import type { MembershipSellMeta } from '@/components/webpos/types';
import { roundMoney2 } from '@/lib/money';

function normalizeRfidUid(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[\s:_\-]+/g, '')
    .toUpperCase();
}

function planSubtitle(plan: MembershipPlan, t: (key: string) => string): string {
  if (plan.type === 'discount' && plan.discountPercent != null) {
    return `${plan.discountPercent}% ${t('off')}`;
  }
  if (plan.type === 'stamp_card' && plan.stampsRequired != null) {
    return `${plan.stampsRequired} ${t('membershipStamps')}`;
  }
  return '';
}

type Props = {
  open: boolean;
  plans: MembershipPlan[];
  onClose: () => void;
  onSold: (membership: AttachedMembership) => void;
  onAddToCart?: (meta: MembershipSellMeta, lineName: string) => void;
};

export default function WebPosMembershipSellModal({ open, plans, onClose, onSold, onAddToCart }: Props) {
  const { t } = useI18n();
  const { overlayClassName, overlayStyle, modalStyle, scrollFieldIntoView, keyboardActive, overlayFocusHandlers } =
    useModalKeyboardScroll();
  const activePlans = plans.filter((p) => p.active);
  const [planId, setPlanId] = useState(activePlans[0]?.id || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlanId(activePlans[0]?.id || '');
    setPriceOverride('');
  }, [open, activePlans]);

  useEffect(() => {
    if (!open || !keyboardActive) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) scrollFieldIntoView(active);
  }, [keyboardActive, open, scrollFieldIntoView]);

  if (!open) return null;

  const selected = activePlans.find((p) => p.id === planId) || activePlans[0] || null;
  const planPrice = roundMoney2(Number(selected?.sellPrice || 0));
  const sellAmount = roundMoney2(
    Number(priceOverride !== '' ? priceOverride : planPrice)
  );

  const submit = async () => {
    const rfid = normalizeRfidUid(cardNumber);
    if (!selected || !rfid || !name.trim()) {
      toast.error(t('membershipSellMissingFields'));
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error(t('membershipSellContactRequired'));
      return;
    }
    if (sellAmount > 0 && onAddToCart) {
      onAddToCart(
        {
          cardNumber: rfid,
          planId: selected.id,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          amount: sellAmount,
        },
        `${selected.label} CHF ${sellAmount.toFixed(2)}`
      );
      onClose();
      setName('');
      setEmail('');
      setPhone('');
      setCardNumber('');
      setPriceOverride('');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/gift-cards/sell-membership', {
        cardNumber: rfid,
        planId: selected.id,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        amount: sellAmount > 0 ? sellAmount : undefined,
      });
      const c = res.data?.card;
      if (!c?.id) throw new Error(t('membershipSellFailed'));
      const holder =
        c.holderName ||
        [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(' ') ||
        name.trim();
      onSold({
        cardId: c.id,
        cardNumber: c.cardNumber || rfid,
        customerName: holder,
        customerId: c.customerId || c.customer?.id || null,
        pointsBalance: Math.max(0, Math.floor(Number(c.pointsBalance ?? 0))),
        giftBalance: Number(c.balance ?? 0),
        membershipEnabled: true,
        membershipPlanId: c.membershipPlanId || selected.id,
        membershipPlan: c.membershipPlan || selected,
        stampCount: Number(c.stampCount ?? 0),
      });
      toast.success(t('membershipSellSuccess'));
      onClose();
      setName('');
      setEmail('');
      setPhone('');
      setCardNumber('');
      setPriceOverride('');
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('membershipSellFailed'));
    } finally {
      setBusy(false);
    }
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
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        style={modalStyle}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-stone-900">
            <CreditCard className="h-5 w-5 text-teal-600" />
            {t('membershipSellTitle')}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-stone-700">{t('membershipPlan')}</p>
              {activePlans.length === 0 ? (
                <p className="text-sm text-stone-500">{t('membershipNoActivePlans')}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activePlans.map((plan) => {
                    const selectedPlan = plan.id === (selected?.id || '');
                    const subtitle = planSubtitle(plan, t);
                    const price = roundMoney2(Number(plan.sellPrice || 0));
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setPlanId(plan.id);
                          setPriceOverride('');
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          selectedPlan
                            ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
                            : 'border-stone-200 hover:border-teal-200 hover:bg-stone-50'
                        }`}
                      >
                        <p className="font-semibold text-stone-900">{plan.label}</p>
                        {subtitle ? (
                          <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
                        ) : null}
                        <p className="mt-2 text-sm font-medium text-teal-700">
                          {price > 0
                            ? `CHF ${price.toFixed(2)}`
                            : t('membershipPlanFree')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-stone-700">{t('membershipCustomerDetails')}</p>
              <label className="block text-sm">
                <span className="font-medium">{t('name')}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('email')}</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('phone')}</span>
                <input
                  type="tel"
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                />
              </label>
              <div>
                <span className="text-sm font-medium">{t('membershipScanCard')}</span>
                <RfidScanInput
                  value={cardNumber}
                  onChange={setCardNumber}
                  onScanComplete={(v) => setCardNumber(normalizeRfidUid(v))}
                  className="mt-1"
                />
              </div>
              {onAddToCart && selected ? (
                <label className="block text-sm">
                  <span className="font-medium">{t('membershipPriceOverride')}</span>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {t('membershipPlanSellPriceHint').replace(
                      '{price}',
                      planPrice > 0 ? `CHF ${planPrice.toFixed(2)}` : t('membershipPlanFree')
                    )}
                  </p>
                  <input
                    className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceOverride}
                    placeholder={planPrice > 0 ? planPrice.toFixed(2) : '0'}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                  />
                </label>
              ) : null}
              {selected?.type === 'stamp_card' && (
                <p className="text-xs text-stone-500">{t('membershipStampHint')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !activePlans.length}
            onClick={() => void submit()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? t('saving') : t('membershipRegisterCard')}
          </button>
        </div>
      </div>
    </div>
  );
}
