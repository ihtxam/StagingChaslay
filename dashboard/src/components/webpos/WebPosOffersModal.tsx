import { Tag, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { formatOfferDiscount, offerMinOrder, type PosOffer } from '@/lib/pos-offers';

const CHANNEL_LABEL_KEYS: Record<string, string> = {
  takeaway: 'webPosOfferChannelPickup',
  delivery: 'webPosOfferChannelDelivery',
  dine_in: 'webPosOfferChannelDineIn',
};

type Props = {
  open: boolean;
  offers: PosOffer[];
  categoryNames?: Record<string, string>;
  productNames?: Record<string, string>;
  onClose: () => void;
};

export default function WebPosOffersModal({
  open,
  offers,
  categoryNames = {},
  productNames = {},
  onClose,
}: Props) {
  const { t, formatDate, formatDateTime } = useI18n();
  if (!open) return null;

  const channelLabel = (id: string) => t(CHANNEL_LABEL_KEYS[id] || id) || id;
  const dayLabel = (key: string) => t(`webPosOfferDay_${key}`) || key;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('close')}
        className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-offers-title"
        className="relative z-[61] flex max-h-[min(88vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
          <Tag size={18} className="text-amber-700" aria-hidden />
          <h2 id="webpos-offers-title" className="flex-1 text-base font-bold text-stone-900">
            {t('webPosOffersTitle')}
          </h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-50"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {offers.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-stone-500">{t('webPosOffersEmpty')}</p>
          ) : (
            <ul className="space-y-2.5">
              {offers.map((offer) => {
                const scheduled = offer.posStatus === 'scheduled';
                const discount = formatOfferDiscount(offer);
                const minOrder = offerMinOrder(offer);
                const channels = offer.channels || [];
                const days = offer.daysOfWeek || [];
                const catNames = (offer.categoryIds || [])
                  .map((id) => categoryNames[id])
                  .filter(Boolean);
                const prodNames = (offer.productIds || [])
                  .map((id) => productNames[id])
                  .filter(Boolean);
                return (
                  <li
                    key={offer.id}
                    className="rounded-xl border border-amber-100 bg-amber-50/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-bold text-stone-900">{offer.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          scheduled
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {scheduled ? t('webPosOfferScheduled') : t('webPosOfferActiveToday')}
                      </span>
                    </div>
                    {discount ? (
                      <p className="mt-1 text-sm font-semibold text-amber-900">
                        {t('webPosOfferDiscount')}: {discount}
                      </p>
                    ) : null}
                    {offer.description ? (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                          {t('webPosOfferTerms')}
                        </p>
                        <p className="text-sm text-stone-700">{offer.description}</p>
                      </div>
                    ) : null}
                    <dl className="mt-2 space-y-1 text-xs text-stone-600">
                      {minOrder > 0 ? (
                        <div>
                          <dt className="inline font-semibold">{t('offerMinOrder')}: </dt>
                          <dd className="inline">CHF {minOrder.toFixed(2)}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="inline font-semibold">{t('webPosOfferChannels')}: </dt>
                        <dd className="inline">
                          {channels.length
                            ? channels.map(channelLabel).join(', ')
                            : t('webPosOfferAllChannels')}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold">{t('webPosOfferSchedule')}: </dt>
                        <dd className="inline">
                          {offer.scheduleMode === 'days' && days.length
                            ? days.map(dayLabel).join(', ')
                            : t('webPosOfferAlways')}
                          {offer.timeStart || offer.timeEnd
                            ? ` · ${offer.timeStart || '…'}–${offer.timeEnd || '…'}`
                            : ''}
                        </dd>
                      </div>
                      {offer.validFrom || offer.validTo ? (
                        <div>
                          <dt className="inline font-semibold">{t('webPosOfferValid')}: </dt>
                          <dd className="inline">
                            {offer.validFrom ? formatDate(offer.validFrom) : '…'}
                            {' → '}
                            {offer.validTo ? formatDateTime(offer.validTo) : '…'}
                          </dd>
                        </div>
                      ) : null}
                      {catNames.length ? (
                        <div>
                          <dt className="inline font-semibold">{t('categories')}: </dt>
                          <dd className="inline">{catNames.join(', ')}</dd>
                        </div>
                      ) : null}
                      {prodNames.length ? (
                        <div>
                          <dt className="inline font-semibold">{t('products')}: </dt>
                          <dd className="inline">{prodNames.join(', ')}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
