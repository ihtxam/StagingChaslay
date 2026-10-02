import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type SlotRow = {
  id: string;
  start: string;
  end: string;
  label: string;
};

function newSlot(): SlotRow {
  return {
    id: `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    start: '21:00',
    end: '06:00',
    label: '',
  };
}

export default function TimeSlotPricingPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/settings');
      const raw = res.data?.settings?.timeSlotPricingSettings || {};
      setEnabled(raw.enabled === true);
      const list = Array.isArray(raw.slots) ? raw.slots : [];
      setSlots(
        list.length
          ? list.map((s: SlotRow) => ({
              id: String(s.id || newSlot().id),
              start: String(s.start || '00:00'),
              end: String(s.end || '23:59'),
              label: String(s.label || ''),
            }))
          : [newSlot()]
      );
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('timeSlotPricingLoadFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/merchant/settings', {
        timeSlotPricingSettings: {
          enabled,
          slots: slots.map((s) => ({
            id: s.id,
            start: s.start,
            end: s.end,
            label: s.label.trim() || null,
          })),
        },
      });
      toast.success(t('timeSlotPricingSaved'));
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('timeSlotPricingSaveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">{t('loading')}</div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('timeSlotPricingTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('timeSlotPricingDescription')}</p>
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t('timeSlotPricingEnable')}
        </label>
        <p className="text-xs text-[var(--text-muted)]">{t('timeSlotPricingEnableHint')}</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('timeSlotPricingSlots')}</h2>
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-1"
              onClick={() => setSlots((prev) => [...prev, newSlot()])}
            >
              {t('timeSlotPricingAddSlot')}
            </button>
          </div>
          {slots.map((slot, idx) => (
            <div
              key={slot.id}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end border border-[var(--border)] rounded-md p-3"
            >
              <label className="text-xs block">
                {t('timeSlotPricingLabel')}
                <input
                  className="input mt-1 w-full"
                  value={slot.label}
                  onChange={(e) => {
                    const next = [...slots];
                    next[idx] = { ...slot, label: e.target.value };
                    setSlots(next);
                  }}
                  placeholder={t('timeSlotPricingLabelPlaceholder')}
                />
              </label>
              <label className="text-xs block">
                {t('timeSlotPricingStart')}
                <input
                  type="time"
                  className="input mt-1 w-full"
                  value={slot.start}
                  onChange={(e) => {
                    const next = [...slots];
                    next[idx] = { ...slot, start: e.target.value };
                    setSlots(next);
                  }}
                />
              </label>
              <label className="text-xs block">
                {t('timeSlotPricingEnd')}
                <input
                  type="time"
                  className="input mt-1 w-full"
                  value={slot.end}
                  onChange={(e) => {
                    const next = [...slots];
                    next[idx] = { ...slot, end: e.target.value };
                    setSlots(next);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-secondary text-xs px-2 py-2"
                disabled={slots.length <= 1}
                onClick={() => setSlots((prev) => prev.filter((_, i) => i !== idx))}
              >
                {t('remove')}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--text-muted)]">{t('timeSlotPricingOverlapHint')}</p>
        <p className="text-xs text-[var(--text-muted)]">{t('timeSlotPricingPosHint')}</p>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </form>
    </div>
  );
}
