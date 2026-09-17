import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { APP_NAME } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';

export type WebPosEntitlement = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'trial'
    | 'subscription'
    | 'legacy'
    | 'trial_expired'
    | 'subscription_expired'
    | 'suspended'
    | 'not_found'
    | string;
  status: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionPlan: string | null;
  daysRemaining: number | null;
  reseller: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
};

type Props = {
  entitlement: WebPosEntitlement;
  businessName?: string | null;
};

export default function WebPosLicenseGate({ entitlement, businessName }: Props) {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const [contactBusy, setContactBusy] = useState(false);

  const title =
    entitlement.reason === 'suspended'
      ? t('webPosLicenseSuspendedTitle')
      : entitlement.reason === 'subscription_expired'
        ? t('webPosLicenseSubExpiredTitle')
        : t('webPosLicenseTrialExpiredTitle');

  const body =
    entitlement.reason === 'suspended'
      ? t('webPosLicenseSuspendedBody')
      : entitlement.reason === 'subscription_expired'
        ? t('webPosLicenseSubExpiredBody')
        : t('webPosLicenseTrialExpiredBody');

  const endedAt =
    entitlement.reason === 'subscription_expired'
      ? entitlement.subscriptionEndsAt
      : entitlement.trialEndsAt;

  const endedLabel = endedAt ? formatDate(endedAt) : null;

  const reseller = entitlement.reseller;

  const contactReseller = async () => {
    if (contactBusy) return;
    setContactBusy(true);
    try {
      const reasonLabel =
        entitlement.reason === 'suspended'
          ? 'suspended'
          : entitlement.reason === 'subscription_expired'
            ? 'subscription_expired'
            : 'trial_expired';
      await api.post('/merchant/support/tickets', {
        category: 'miscellaneous',
        subcategory: 'license_renewal',
        subject: t('webPosLicenseMailSubject'),
        body: t('webPosLicenseContactBody')
          .replace('{reason}', reasonLabel)
          .replace('{business}', businessName || APP_NAME),
      });
      toast.success(t('webPosLicenseContactSent'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      toast.error(err.response?.data?.error || err.message || t('webPosLicenseContactFailed'));
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          {businessName || APP_NAME}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">{body}</p>
        {endedLabel ? (
          <p className="mt-2 text-sm text-stone-500">
            {t('webPosLicenseEndedOn').replace('{date}', endedLabel)}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white hover:bg-stone-800"
            onClick={() => navigate('/merchant/billing')}
          >
            {t('webPosLicenseBuy')}
          </button>
          {reseller ? (
            <button
              type="button"
              disabled={contactBusy}
              className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-center text-sm font-bold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
              onClick={() => void contactReseller()}
            >
              {contactBusy ? t('webPosLicenseContacting') : t('webPosLicenseContactReseller')}
            </button>
          ) : (
            <button
              type="button"
              className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-800 hover:bg-stone-50"
              onClick={() => navigate('/merchant/settings')}
            >
              {t('webPosLicenseContactSupport')}
            </button>
          )}
        </div>

        {reseller ? (
          <div className="mt-6 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
            <p className="font-semibold">{t('webPosLicenseYourReseller')}</p>
            <p className="mt-1">{reseller.name}</p>
            {reseller.email ? (
              <p className="mt-0.5">
                <a className="text-teal-800 underline" href={`mailto:${reseller.email}`}>
                  {reseller.email}
                </a>
              </p>
            ) : null}
            {reseller.phone ? (
              <p className="mt-0.5">
                <a className="text-teal-800 underline" href={`tel:${reseller.phone}`}>
                  {reseller.phone}
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-xs text-stone-500">{t('webPosLicenseNoResellerHint')}</p>
        )}
      </div>
    </div>
  );
}
