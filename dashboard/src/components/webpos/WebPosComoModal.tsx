import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Award, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  comoMemberLabel,
  fetchComoBenefits,
  identifyComoMember,
  type ComoAsset,
  type ComoCartItem,
  type ComoMember,
  type ComoSession,
} from '@/lib/como-client';

type Props = {
  open: boolean;
  session: ComoSession;
  items: ComoCartItem[];
  totalMajor: number;
  orderType: string;
  onClose: () => void;
  onChange: (next: ComoSession) => void;
};

export default function WebPosComoModal({
  open,
  session,
  items,
  totalMajor,
  orderType,
  onClose,
  onChange,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState(session.identifier || session.phone || session.email || session.membershipKey || '');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>(session.assetKeys);

  const assets: ComoAsset[] = session.member?.assets || [];

  const memberName = useMemo(() => comoMemberLabel(session.member), [session.member]);

  if (!open) return null;

  const lookup = async () => {
    const identifier = query.trim();
    if (!identifier) return;
    setBusy(true);
    try {
      const data = await identifyComoMember({
        identifier,
        transactionId: session.transactionId || undefined,
        orderType,
        items,
        totalMajor,
      });
      const member: ComoMember = data.member;
      onChange({
        ...session,
        transactionId: data.transactionId,
        identifier,
        membershipKey: member.membershipKey,
        phone: member.phoneNumber,
        email: member.email,
        member,
        assetKeys: [],
        discountMajor: 0,
      });
      setSelected([]);
      if (member.notFound) toast.error(t('comoNotFound'));
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('comoNotFound'));
    } finally {
      setBusy(false);
    }
  };

  const applyRewards = async () => {
    if (!session.member) return;
    setBusy(true);
    try {
      const data = await fetchComoBenefits({
        identifier: session.identifier,
        phone: session.phone,
        email: session.email,
        membershipKey: session.membershipKey,
        transactionId: session.transactionId,
        orderType,
        items,
        totalMajor,
        assetKeys: selected,
      });
      onChange({
        ...session,
        transactionId: data.transactionId || session.transactionId,
        assetKeys: selected,
        discountMajor: Math.round((data.totalDiscountMinor || 0)) / 100,
      });
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('comoApplyReward'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <Award className="h-5 w-5 text-teal-700" />
            {t('comoIdentifyTitle')}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-sm text-stone-600">{t('comoIdentifyHint')}</p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${t('comoPhone')} / ${t('comoEmail')} / ${t('comoCode')}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void lookup();
                }
              }}
            />
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void lookup()}>
              {t('comoLookup')}
            </button>
          </div>
          {session.member && !session.member.notFound ? (
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm">
              <div className="font-semibold text-teal-900">{memberName}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-teal-800">
                {session.member.pointsBalance != null ? (
                  <span>
                    {t('comoPoints')}: {session.member.pointsBalance}
                  </span>
                ) : null}
                {session.member.creditBalance != null ? (
                  <span>
                    {t('comoCredit')}: {(session.member.creditBalance / 100).toFixed(2)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {assets.length ? (
            <div>
              <div className="mb-2 text-sm font-semibold">{t('comoRewards')}</div>
              <ul className="space-y-2">
                {assets.map((asset) => {
                  const checked = selected.includes(asset.key);
                  const punch =
                    asset.punches != null && asset.punchesRequired != null
                      ? t('comoPunchCard', { used: asset.punches, total: asset.punchesRequired })
                      : null;
                  return (
                    <li key={asset.key}>
                      <label className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          disabled={asset.redeemable === false}
                          onChange={() =>
                            setSelected((prev) =>
                              checked ? prev.filter((k) => k !== asset.key) : [...prev, asset.key]
                            )
                          }
                        />
                        <span>
                          <span className="block font-medium">{asset.name || asset.key}</span>
                          <span className="block text-xs text-stone-500">
                            {asset.redeemable === false ? t('comoNotRedeemable') : t('comoRedeemable')}
                            {punch ? ` · ${punch}` : ''}
                          </span>
                          {asset.description ? (
                            <span className="mt-1 block text-xs text-stone-500">{asset.description}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 border-t px-4 py-3">
          {session.member ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onChange({
                  transactionId: session.transactionId,
                  assetKeys: [],
                  discountMajor: 0,
                  member: null,
                });
                setSelected([]);
                setQuery('');
              }}
            >
              {t('comoClearMember')}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy || !session.member || session.member.notFound}
            onClick={() => void applyRewards()}
          >
            {t('comoApplyReward')}
          </button>
        </div>
      </div>
    </div>
  );
}
