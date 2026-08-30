import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Copy, Save } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  STORE_HOURS_DAYS,
  cloneHoursSlots,
  emptyStoreHours,
  mergeStoreHours,
  type ChannelHours,
  type HoursChannelKey,
  type HoursSlot,
  type StoreHours,
  type StoreHoursDayKey,
} from '@/lib/store-hours';
import {
  settingsDash,
  SettingsReportCard,
  SettingsPageHeader,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

const ORDER_CHANNELS: HoursChannelKey[] = ['takeaway', 'dine_in', 'delivery'];

function mkWeekFromChannel(ch: ChannelHours): ChannelHours {
  return Object.fromEntries(
    STORE_HOURS_DAYS.map((d) => [d.key, cloneHoursSlots(ch[d.key] || [])])
  ) as ChannelHours;
}

function defaultDaySlots(): HoursSlot[] {
  return [
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ];
}

function formatDaySummary(slots: HoursSlot[]): string {
  if (!slots.length) return 'Closed';
  return slots.map((s) => `${s.open}–${s.close}`).join(', ');
}

export default function SettingsHoursTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<StoreHours>(emptyStoreHours());
  const [sameForAllChannels, setSameForAllChannels] = useState(true);
  const [splitLunchDinner, setSplitLunchDinner] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/settings');
      const merged = mergeStoreHours(res.data.settings?.storeHours);
      setHours(merged);
      const pickup = merged.takeaway || {};
      const dineIn = merged.dine_in || {};
      const delivery = merged.delivery || {};
      const same =
        JSON.stringify(pickup) === JSON.stringify(dineIn) &&
        JSON.stringify(pickup) === JSON.stringify(delivery);
      setSameForAllChannels(same);
      const mon = pickup.mon || [];
      setSplitLunchDinner(mon.length > 1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const primaryWeek = hours.takeaway || {};

  const setPrimaryDay = (day: StoreHoursDayKey, slots: HoursSlot[]) => {
    setHours((prev) => {
      const week = { ...(prev.takeaway || {}) };
      week[day] = slots;
      const next: StoreHours = { ...prev, takeaway: week };
      if (sameForAllChannels) {
        for (const ch of ORDER_CHANNELS) {
          next[ch] = mkWeekFromChannel(week);
        }
      }
      next.display = mkWeekFromChannel(week);
      return next;
    });
  };

  const applyWeekPreset = (preset: 'weekdays' | 'everyday' | 'closed') => {
    const days =
      preset === 'everyday'
        ? STORE_HOURS_DAYS.map((d) => d.key)
        : preset === 'weekdays'
          ? (['mon', 'tue', 'wed', 'thu', 'fri'] as StoreHoursDayKey[])
          : STORE_HOURS_DAYS.map((d) => d.key);
    const slots = preset === 'closed' ? [] : splitLunchDinner ? defaultDaySlots() : [{ open: '09:00', close: '22:00' }];
    setHours((prev) => {
      const week: ChannelHours = { ...(prev.takeaway || {}) };
      for (const day of days) {
        week[day] = cloneHoursSlots(slots);
      }
      const next: StoreHours = { ...prev, takeaway: week };
      if (sameForAllChannels) {
        for (const ch of ORDER_CHANNELS) {
          next[ch] = mkWeekFromChannel(week);
        }
      }
      next.display = mkWeekFromChannel(week);
      return next;
    });
  };

  const toggleSameForAll = (on: boolean) => {
    setSameForAllChannels(on);
    if (on) {
      const week = mkWeekFromChannel(hours.takeaway || {});
      setHours((prev) => ({
        ...prev,
        takeaway: week,
        dine_in: mkWeekFromChannel(week),
        delivery: mkWeekFromChannel(week),
        display: mkWeekFromChannel(week),
      }));
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let payload = hours;
      if (sameForAllChannels) {
        const week = mkWeekFromChannel(hours.takeaway || {});
        payload = {
          ...hours,
          takeaway: week,
          dine_in: mkWeekFromChannel(week),
          delivery: mkWeekFromChannel(week),
          display: mkWeekFromChannel(week),
        };
      }
      await api.put('/merchant/settings', { storeHours: payload });
      setHours(payload);
      toast.success(t('hoursSaved'));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  return (
    <form onSubmit={onSave} className="space-y-5">
      <SettingsPageHeader
        title={t('settingsHours')}
        subtitle={t('hoursSimpleHint')}
        action={
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? t('saving') : t('save')}
          </button>
        }
      />

      <SettingsReportCard
        icon={Clock}
        accent={settingsDash.accent}
        title={t('hoursSimpleTitle')}
        description={t('hoursSimpleDescription')}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => applyWeekPreset('weekdays')}>
            {t('hoursWeekdaysOpen')}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => applyWeekPreset('everyday')}>
            {t('hoursAllWeekOpen')}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => applyWeekPreset('closed')}>
            {t('hoursMarkAllClosed')}
          </button>
        </div>

        <SettingsToggleRow
          checked={splitLunchDinner}
          onChange={setSplitLunchDinner}
          title={t('hoursSplitLunchDinner')}
          hint={t('hoursSplitLunchDinnerHint')}
        />

        <SettingsToggleRow
          checked={sameForAllChannels}
          onChange={toggleSameForAll}
          title={t('hoursSameAllChannels')}
          hint={t('hoursSameAllChannelsHint')}
        />

        <div className="space-y-2">
          {STORE_HOURS_DAYS.map((d) => {
            const slots = primaryWeek[d.key] || [];
            const closed = slots.length === 0;
            return (
              <div
                key={d.key}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/20 px-3 py-2.5"
              >
                <span className="w-10 text-sm font-bold">{d.label}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) =>
                      setPrimaryDay(
                        d.key,
                        e.target.checked ? [] : splitLunchDinner ? defaultDaySlots() : [{ open: '09:00', close: '22:00' }]
                      )
                    }
                  />
                  {t('reservationsClosedDay')}
                </label>
                {!closed ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {(slots.length ? slots : defaultDaySlots()).map((slot, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1">
                        <input
                          type="time"
                          className="input w-auto py-1"
                          value={slot.open}
                          onChange={(e) => {
                            const next = cloneHoursSlots(slots.length ? slots : defaultDaySlots());
                            next[idx] = { ...next[idx], open: e.target.value };
                            setPrimaryDay(d.key, next);
                          }}
                        />
                        <span className="text-[var(--text-muted)]">–</span>
                        <input
                          type="time"
                          className="input w-auto py-1"
                          value={slot.close}
                          onChange={(e) => {
                            const next = cloneHoursSlots(slots.length ? slots : defaultDaySlots());
                            next[idx] = { ...next[idx], close: e.target.value };
                            setPrimaryDay(d.key, next);
                          }}
                        />
                      </span>
                    ))}
                    <button
                      type="button"
                      className="font-semibold text-teal-700"
                      onClick={() => {
                        const next = cloneHoursSlots(slots.length ? slots : defaultDaySlots());
                        next.push({ open: '17:00', close: '23:00' });
                        setPrimaryDay(d.key, next);
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">{formatDaySummary(slots)}</span>
                )}
              </div>
            );
          })}
        </div>

        {!sameForAllChannels ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            {t('hoursPerChannelNote')}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            <Copy className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {t('hoursPosUsesPickup')}
          </p>
        )}
      </SettingsReportCard>

      <div className="flex justify-end sm:hidden">
        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="h-4 w-4" aria-hidden />
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
