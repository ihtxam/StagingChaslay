import { useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, X } from 'lucide-react';
import api from '@/lib/api';
import RfidScanInput from '@/components/RfidScanInput';
import { useI18n } from '@/lib/i18n';
import type { MembershipPlan } from '@/lib/membership-plans';
import type { AttachedMembership } from '@/lib/loyalty-math';

function normalizeRfidUid(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[\s:_\-]+/g, '')
    .toUpperCase();
}

type Props = {
  open: boolean;
  plans: MembershipPlan[];
  onClose: () => void;
  onSold: (membership: AttachedMembership) => void;
};

export default function WebPosMembershipSellModal({ open, plans, onClose, onSold }: Props) {
  const { t } = useI18n();
  const activePlans = plans.filter((p) => p.active);
  const [planId, setPlanId] = useState(activePlans[0]?.id || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const selected = activePlans.find((p) => p.id === planId) || activePlans[0] || null;

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
    setBusy(true);
    try {
      const res = await api.post('/gift-cards/sell-membership', {
        cardNumber: rfid,
        planId: selected.id,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
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
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('membershipSellFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-stone-900">
            <CreditCard className="h-5 w-5 text-teal-600" />
            {t('membershipSellTitle')}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-sm">
            <span className="font-medium">{t('membershipPlan')}</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.type === 'discount' && p.discountPercent != null
                    ? ` (${p.discountPercent}% ${t('off')})`
                    : p.type === 'stamp_card'
                      ? ` (${p.stampsRequired} ${t('membershipStamps')})`
                      : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t('name')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t('phone')}</span>
            <input
              type="tel"
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
          {selected?.type === 'stamp_card' && (
            <p className="text-xs text-stone-500">{t('membershipStampHint')}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
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
