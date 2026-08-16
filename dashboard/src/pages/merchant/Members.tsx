import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { MembershipPlan } from '@/lib/membership-plans';

type MemberCard = {
  id: string;
  cardNumber: string;
  cardMediaType: string;
  balance?: string | null;
  stampCount?: number | null;
  pointsBalance?: number | null;
  status: string;
  membershipEnabled?: boolean;
  membershipPlanId?: string | null;
  membershipPlan?: MembershipPlan | null;
  holderName?: string | null;
  holderEmail?: string | null;
  holderPhone?: string | null;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type SpendingOrder = {
  id: string;
  orderNumber: string;
  total: string;
  createdAt: string;
  status: string;
  paymentStatus?: string | null;
};

type SpendingStats = {
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
};

const MAX_PHONE_DIGITS = 15;

function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);
}

function memberName(card: MemberCard): string {
  return (
    card.holderName ||
    [card.customer?.firstName, card.customer?.lastName].filter(Boolean).join(' ') ||
    '—'
  );
}

function planLabel(card: MemberCard): string {
  if (!card.membershipEnabled && Number(card.balance || 0) > 0) return 'Gift card';
  if (card.membershipPlan?.label) return card.membershipPlan.label;
  if (card.membershipEnabled) return 'Membership';
  return '—';
}

function balanceLabel(card: MemberCard, t: (k: string) => string): string {
  if (card.membershipPlan?.type === 'stamp_card') {
    const req = card.membershipPlan.stampsRequired || 6;
    return `${card.stampCount ?? 0} / ${req} ${t('membershipStamps')}`;
  }
  if (Number(card.balance || 0) > 0 || !card.membershipEnabled) {
    return `CHF ${Number(card.balance || 0).toFixed(2)}`;
  }
  if ((card.pointsBalance ?? 0) > 0) return `${card.pointsBalance} ${t('points')}`;
  return '—';
}

function statusLabel(status: string, t: (k: string) => string): string {
  if (status === 'active') return t('membersStatusActive');
  if (status === 'suspended') return t('membersStatusBlocked');
  return status;
}

export default function Members() {
  const { t, formatDateTime } = useI18n();
  const [cards, setCards] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberCard | null>(null);
  const [spending, setSpending] = useState<SpendingStats | null>(null);
  const [orders, setOrders] = useState<SpendingOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [topUpBusy, setTopUpBusy] = useState(false);

  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpStamps, setTopUpStamps] = useState('1');
  const [topUpNote, setTopUpNote] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (statusFilter === 'active') params.status = 'active';
      if (statusFilter === 'blocked') params.status = 'suspended';
      if (search.trim()) params.q = search.trim();
      const res = await api.get('/gift-cards', { params });
      setCards(res.data.cards || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('membersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (cardId: string) => {
      setDetailLoading(true);
      try {
        const [cardRes, spendRes] = await Promise.all([
          api.get(`/gift-cards/${cardId}`),
          api.get(`/gift-cards/${cardId}/spending`, { params: { limit: 30 } }),
        ]);
        const card = cardRes.data.card as MemberCard;
        setDetail(card);
        setSpending(spendRes.data.statistics || null);
        setOrders(spendRes.data.orders || []);
        const parts = memberName(card).split(/\s+/).filter(Boolean);
        setEditFirst(card.customer?.firstName || parts[0] || '');
        setEditLast(card.customer?.lastName || parts.slice(1).join(' ') || '');
        setEditEmail(card.holderEmail || card.customer?.email || '');
        setEditPhone(card.holderPhone || card.customer?.phone || '');
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('membersDetailFailed'));
        setSelectedId(null);
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setDetail(null);
      setSpending(null);
      setOrders([]);
    }
  }, [selectedId, loadDetail]);

  const openCard = (card: MemberCard) => setSelectedId(card.id);
  const closeDetail = () => setSelectedId(null);

  const filteredCards = useMemo(() => cards, [cards]);

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const tel = sanitizePhoneInput(editPhone);
    if (editPhone.trim() && !/^\d{1,15}$/.test(tel)) {
      toast.error(t('customersPhoneInvalid'));
      return;
    }
    setSaving(true);
    try {
      const holderName = [editFirst.trim(), editLast.trim()].filter(Boolean).join(' ');
      await api.patch(`/gift-cards/${selectedId}`, {
        holderName: holderName || undefined,
        holderEmail: editEmail.trim() || undefined,
        holderPhone: tel || undefined,
        firstName: editFirst.trim() || undefined,
        lastName: editLast.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: tel || undefined,
      });
      toast.success(t('membersSaved'));
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('membersSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const applyTopUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setTopUpBusy(true);
    try {
      const payload =
        detail.membershipPlan?.type === 'stamp_card'
          ? { type: 'stamps', stamps: Math.max(1, Math.floor(Number(topUpStamps) || 1)), note: topUpNote.trim() || undefined }
          : { type: 'balance', amount: Number(topUpAmount), note: topUpNote.trim() || undefined };
      const res = await api.post(`/gift-cards/${selectedId}/top-up`, payload);
      if (res.data?.rewardEarned) toast.success(t('membershipRewardEarned'));
      else toast.success(t('membersTopUpSuccess'));
      setTopUpAmount('');
      setTopUpNote('');
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('membersTopUpFailed'));
    } finally {
      setTopUpBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!selectedId || !detail) return;
    try {
      if (detail.status === 'active') {
        await api.post(`/gift-cards/${selectedId}/suspend`, { reason: 'Blocked by merchant' });
        toast.success(t('membersBlocked'));
      } else {
        await api.post(`/gift-cards/${selectedId}/reactivate`);
        toast.success(t('membersUnblocked'));
      }
      await loadDetail(selectedId);
      await loadList();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('giftCardStatusFailed'));
    }
  };

  if (loading && cards.length === 0) {
    return <div className="text-center py-12">{t('loading')}…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">{t('membersPageTitle')}</h1>
        <p className="text-sm muted mb-4">{t('membersPageSubtitle')}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10 w-full"
              placeholder={t('membersSearchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadList()}
            />
          </div>
          <select
            className="input sm:w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">{t('membersFilterAll')}</option>
            <option value="active">{t('membersFilterActive')}</option>
            <option value="blocked">{t('membersFilterBlocked')}</option>
          </select>
          <button type="button" className="btn-secondary" onClick={() => void loadList()}>
            {t('search')}
          </button>
        </div>
      </div>

      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left border-b">
              <th className="px-3 py-2">{t('name')}</th>
              <th className="px-3 py-2">{t('customersPhone')}</th>
              <th className="px-3 py-2">{t('customersEmail')}</th>
              <th className="px-3 py-2">{t('giftCardNumber')}</th>
              <th className="px-3 py-2">{t('membershipPlan')}</th>
              <th className="px-3 py-2">{t('balance')}</th>
              <th className="px-3 py-2">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCards.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-gray-500 text-center">
                  {t('membersEmpty')}
                </td>
              </tr>
            )}
            {filteredCards.map((card) => (
              <tr
                key={card.id}
                className={`border-b last:border-0 cursor-pointer hover:bg-slate-50 ${
                  selectedId === card.id ? 'bg-teal-50' : ''
                }`}
                onClick={() => openCard(card)}
              >
                <td className="px-3 py-3 font-medium">{memberName(card)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {card.holderPhone || card.customer?.phone || '—'}
                </td>
                <td className="px-3 py-3">
                  <span className="cell-truncate block max-w-[160px]" title={card.holderEmail || card.customer?.email || ''}>
                    {card.holderEmail || card.customer?.email || '—'}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{card.cardNumber}</td>
                <td className="px-3 py-3">{planLabel(card)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{balanceLabel(card, t)}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      card.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {statusLabel(card.status, t)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={closeDetail}>
          <div
            className="w-full max-w-lg h-full bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold">{t('membersDetailTitle')}</h2>
              <button type="button" className="p-2 rounded-lg hover:bg-slate-100" onClick={closeDetail} aria-label={t('close')}>
                <X size={20} />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="p-8 text-center muted">{t('loading')}…</div>
            ) : (
              <div className="p-4 space-y-6">
                <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
                  <div className="font-mono text-xs text-slate-500">{detail.cardNumber}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="font-semibold">{planLabel(detail)}</span>
                    <span className="text-slate-400">·</span>
                    <span>{balanceLabel(detail, t)}</span>
                    <span className="text-slate-400">·</span>
                    <span>{statusLabel(detail.status, t)}</span>
                  </div>
                  {spending && (
                    <p className="text-teal-700 font-semibold pt-1">
                      {t('membersTotalSpent')}: CHF {spending.totalSpent.toFixed(2)} ({spending.orderCount}{' '}
                      {t('membersOrders')})
                    </p>
                  )}
                </div>

                <form onSubmit={saveEdit} className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold">{t('membersEditContact')}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="input"
                      placeholder={t('customersFirstName')}
                      value={editFirst}
                      onChange={(e) => setEditFirst(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder={t('customersLastName')}
                      value={editLast}
                      onChange={(e) => setEditLast(e.target.value)}
                    />
                  </div>
                  <input
                    className="input w-full"
                    type="email"
                    placeholder={t('customersEmail')}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                  <input
                    className="input w-full"
                    inputMode="numeric"
                    placeholder={t('customersPhone')}
                    maxLength={MAX_PHONE_DIGITS}
                    value={editPhone}
                    onChange={(e) => setEditPhone(sanitizePhoneInput(e.target.value))}
                  />
                  <button type="submit" className="btn-primary w-full" disabled={saving}>
                    {saving ? t('saving') : t('save')}
                  </button>
                </form>

                <form onSubmit={applyTopUp} className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold">{t('membersManualTopUp')}</h3>
                  {detail.membershipPlan?.type === 'stamp_card' ? (
                    <label className="block text-sm">
                      <span className="text-slate-600">{t('membersStampsToAdd')}</span>
                      <input
                        className="input mt-1 w-full"
                        type="number"
                        min="1"
                        step="1"
                        value={topUpStamps}
                        onChange={(e) => setTopUpStamps(e.target.value)}
                      />
                    </label>
                  ) : (
                    <label className="block text-sm">
                      <span className="text-slate-600">{t('membersAmountChf')}</span>
                      <input
                        className="input mt-1 w-full"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        required
                      />
                    </label>
                  )}
                  <input
                    className="input w-full"
                    placeholder={t('membersTopUpNote')}
                    value={topUpNote}
                    onChange={(e) => setTopUpNote(e.target.value)}
                  />
                  <button type="submit" className="btn-primary w-full" disabled={topUpBusy}>
                    {topUpBusy ? t('saving') : t('membersApplyTopUp')}
                  </button>
                </form>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold mb-3">{t('membersSpendingHistory')}</h3>
                  {orders.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('membersNoOrders')}</p>
                  ) : (
                    <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                      {orders.map((o) => (
                        <li key={o.id} className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                          <span>
                            <span className="font-mono text-xs">{o.orderNumber}</span>
                            <span className="block text-xs text-slate-500">
                              {formatDateTime(o.createdAt)}
                            </span>
                          </span>
                          <span className="font-semibold whitespace-nowrap">
                            CHF {Number(o.total).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm ${
                    detail.status === 'active'
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                  onClick={() => void toggleBlock()}
                >
                  {detail.status === 'active' ? t('membersBlockCard') : t('membersUnblockCard')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
