import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { PREP_TIME_PRESETS } from '@/lib/shop-eta';

type PrepSettings = {
  pickupEtaMinutes: number;
  deliveryEtaMinutes: number;
  minPreOrderDelayMinutes: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (settings: PrepSettings) => void;
};

function PrepMinutesField({
  label,
  hint,
  value,
  onChange,
  min = 5,
  max = 240,
  minutesLabel,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  minutesLabel: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-stone-800">{label}</label>
      <div className="flex flex-wrap gap-2">
        {PREP_TIME_PRESETS.map((preset) => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums transition ${
                active
                  ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-violet-300 hover:bg-violet-50'
              }`}
            >
              {preset} {minutesLabel}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          className="input w-24"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span className="text-sm text-stone-600">{minutesLabel}</span>
      </div>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export default function WebPosPrepTimeSettingsModal({ open, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PrepSettings>({
    pickupEtaMinutes: 25,
    deliveryEtaMinutes: 45,
    minPreOrderDelayMinutes: 30,
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void api
      .get('/merchant/settings')
      .then((res) => {
        const s = res.data?.settings || {};
        setForm({
          pickupEtaMinutes: Number(s.pickupEtaMinutes ?? 25),
          deliveryEtaMinutes: Number(s.deliveryEtaMinutes ?? 45),
          minPreOrderDelayMinutes: Number(s.minPreOrderDelayMinutes ?? 30),
        });
      })
      .catch(() => toast.error(t('loadFailed')))
      .finally(() => setLoading(false));
  }, [open, t]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/merchant/settings', form);
      toast.success(t('saved'));
      onSaved?.(form);
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[360] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">{t('orderCenterPrepSettings')}</h2>
              <p className="mt-0.5 text-xs text-stone-500">{t('orderCenterPrepSettingsHint')}</p>
            </div>
          </div>
          <button type="button" className="p-1 text-stone-500" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-stone-500">{t('loading')}</p>
        ) : (
          <div className="mt-5 space-y-4">
            <PrepMinutesField
              label={t('orderCenterPrepTakeaway')}
              hint={t('orderCenterPrepTakeawayHint')}
              value={form.pickupEtaMinutes}
              onChange={(pickupEtaMinutes) => setForm((f) => ({ ...f, pickupEtaMinutes }))}
              minutesLabel={t('minutes')}
            />
            <PrepMinutesField
              label={t('orderCenterPrepDelivery')}
              value={form.deliveryEtaMinutes}
              onChange={(deliveryEtaMinutes) => setForm((f) => ({ ...f, deliveryEtaMinutes }))}
              minutesLabel={t('minutes')}
            />
            <PrepMinutesField
              label={t('orderCenterMinPreOrder')}
              hint={t('orderCenterMinPreOrderHint')}
              value={form.minPreOrderDelayMinutes}
              onChange={(minPreOrderDelayMinutes) =>
                setForm((f) => ({ ...f, minPreOrderDelayMinutes }))
              }
              min={0}
              minutesLabel={t('minutes')}
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-secondary flex-1 py-3 font-bold" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-3 font-bold"
            disabled={loading || saving}
            onClick={() => void save()}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
