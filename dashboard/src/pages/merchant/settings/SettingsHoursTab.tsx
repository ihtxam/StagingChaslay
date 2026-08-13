import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Clock, Copy, LayoutGrid, Save } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  STORE_HOURS_APPLY_CHANNELS,
  STORE_HOURS_DAYS,
  cloneHoursSlots,
  emptyStoreHours,
  mergeStoreHours,
  summarizeChannelHours,
  type ChannelHours,
  type HoursChannelKey,
  type HoursSlot,
  type StoreHours,
  type StoreHoursDayKey,
} from '@/lib/store-hours';
import {
  settingsDash,
  SettingsField,
  SettingsKpiCard,
  SettingsKpiGrid,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

function mkWeekFromChannel(ch: ChannelHours): ChannelHours {
  return Object.fromEntries(
    STORE_HOURS_DAYS.map((d) => [d.key, cloneHoursSlots(ch[d.key] || [])])
  );
}

export default function SettingsHoursTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<StoreHours>(emptyStoreHours());
  const [selectedDays, setSelectedDays] = useState<StoreHoursDayKey[]>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ]);
  const [draftSlots, setDraftSlots] = useState<HoursSlot[]>([
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ]);
  const [editChannel, setEditChannel] = useState<HoursChannelKey>('takeaway');
  const [alsoCopyTo, setAlsoCopyTo] = useState<HoursChannelKey[]>([]);
  const [markClosed, setMarkClosed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/settings');
      setHours(mergeStoreHours(res.data.settings?.storeHours));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleDay = (day: StoreHoursDayKey) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectPresetDays = (preset: 'all' | 'weekdays' | 'weekend') => {
    if (preset === 'all') setSelectedDays(STORE_HOURS_DAYS.map((d) => d.key));
    else if (preset === 'weekdays') setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
    else setSelectedDays(['sat', 'sun']);
  };

  const updateDraftSlot = (index: number, field: 'open' | 'close', value: string) => {
    setDraftSlots((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleAlsoCopyTo = (key: HoursChannelKey) => {
    if (key === editChannel) return;
    setAlsoCopyTo((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectEditChannel = (key: HoursChannelKey) => {
    setEditChannel(key);
    setAlsoCopyTo((prev) => prev.filter((k) => k !== key));
  };

  const channelLabel = (key: HoursChannelKey) => {
    const meta = STORE_HOURS_APPLY_CHANNELS.find((c) => c.key === key);
    return meta ? t(meta.labelKey) : key;
  };

  const applyQuickSchedule = () => {
    if (!selectedDays.length) {
      toast.error(t('hoursSelectDay'));
      return;
    }
    const slots = markClosed
      ? []
      : draftSlots.filter((s) => s.open && s.close).map((s) => ({ open: s.open, close: s.close }));
    if (!markClosed && !slots.length) {
      toast.error(t('hoursAddRange'));
      return;
    }
    const channels = Array.from(new Set<HoursChannelKey>([editChannel, ...alsoCopyTo]));
    setHours((prev) => {
      const next: StoreHours = { ...prev };
      for (const ch of channels) {
        const dayMap: ChannelHours = { ...(next[ch] || {}) };
        for (const day of selectedDays) {
          dayMap[day] = cloneHoursSlots(slots);
        }
        next[ch] = dayMap;
      }
      return next;
    });
    toast.success(t('saved'));
  };

  const copyEditWeekTo = (targets: HoursChannelKey[]) => {
    const source = hours[editChannel] || {};
    const dest = targets.filter((item) => item !== editChannel);
    if (!dest.length) {
      toast.error(t('hoursCopyTarget'));
      return;
    }
    setHours((prev) => {
      const next: StoreHours = { ...prev };
      for (const ch of dest) {
        next[ch] = mkWeekFromChannel(source);
      }
      return next;
    });
    toast.success(t('saved'));
  };

  const setEditDaySlots = (day: string, slots: HoursSlot[]) => {
    setHours((prev) => {
      const channel = { ...(prev[editChannel] || {}) };
      channel[day] = slots;
      return { ...prev, [editChannel]: channel };
    });
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/merchant/settings', { storeHours: hours });
      toast.success(t('hoursSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  const editHours = hours[editChannel] || {};
  const editChannelLabel = channelLabel(editChannel);

  return (
    <form onSubmit={onSave} className="space-y-5">
      <SettingsPageHeader
        title={t('settingsHours')}
        subtitle={t('settingsHoursHint')}
        action={
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? t('saving') : t('save')}
          </button>
        }
      />

      <SettingsKpiGrid>
        {STORE_HOURS_APPLY_CHANNELS.map((c, idx) => {
          const accents = [settingsDash.accent, settingsDash.info, settingsDash.warning, settingsDash.success];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => selectEditChannel(c.key)}
              className="text-left"
            >
              <SettingsKpiCard
                icon={Clock}
                accent={accents[idx % accents.length]}
                label={t(c.labelKey)}
                value={summarizeChannelHours(hours[c.key] || {})}
                muted={editChannel !== c.key}
              />
            </button>
          );
        })}
      </SettingsKpiGrid>

      <SettingsReportCard
        icon={Clock}
        accent={settingsDash.accent}
        title={t('hoursEditingFor')}
        description={t('hoursEditingHint').replace('{channel}', editChannelLabel)}
      >
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-1">
          {STORE_HOURS_APPLY_CHANNELS.map((opt) => {
            const on = editChannel === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => selectEditChannel(opt.key)}
                className={`flex-1 min-w-[6.5rem] rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  on
                    ? 'bg-[var(--text)] text-[var(--bg-elevated)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </SettingsReportCard>

      <SettingsReportCard
        icon={CalendarDays}
        accent={settingsDash.info}
        title={t('hoursQuickDays')}
        description={t('shopHoursNavPos')}
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => selectPresetDays('all')}>
            {t('hoursAllWeek')}
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => selectPresetDays('weekdays')}>
            {t('hoursWeekdays')}
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => selectPresetDays('weekend')}>
            {t('hoursWeekend')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {STORE_HOURS_DAYS.map((d) => {
            const on = selectedDays.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={`min-w-[2.75rem] rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  on
                    ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg-elevated)]'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/25 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold tracking-tight">{t('hoursRanges')}</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  setDraftSlots([
                    { open: '11:00', close: '14:00' },
                    { open: '17:00', close: '23:00' },
                  ])
                }
              >
                {t('hoursLunchDinner')}
              </button>
              <SettingsToggleRow
                checked={markClosed}
                onChange={setMarkClosed}
                title={t('hoursMarkClosed')}
              />
            </div>
          </div>
          {!markClosed && (
            <div className="space-y-2">
              {draftSlots.map((slot, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    className="input w-auto"
                    value={slot.open}
                    onChange={(e) => updateDraftSlot(idx, 'open', e.target.value)}
                  />
                  <span className="text-[var(--text-muted)]">{t('hoursTo')}</span>
                  <input
                    type="time"
                    className="input w-auto"
                    value={slot.close}
                    onChange={(e) => updateDraftSlot(idx, 'close', e.target.value)}
                  />
                  {draftSlots.length > 1 ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-600"
                      onClick={() => setDraftSlots((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      {t('remove')}
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold text-teal-700"
                onClick={() => setDraftSlots((prev) => [...prev, { open: '17:00', close: '23:00' }])}
              >
                {t('hoursAddRange')}
              </button>
            </div>
          )}
        </div>

        <SettingsField label={t('hoursAlsoApply')}>
          <div className="flex flex-wrap gap-2">
            {STORE_HOURS_APPLY_CHANNELS.filter((c) => c.key !== editChannel).map((opt) => {
              const on = alsoCopyTo.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleAlsoCopyTo(opt.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                    on
                      ? 'border-[var(--text)] bg-[var(--bg-muted)] font-semibold shadow-sm'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </SettingsField>

        <button type="button" className="btn-secondary" onClick={applyQuickSchedule}>
          {t('hoursApplyQuick')}
        </button>
      </SettingsReportCard>

      <SettingsReportCard
        icon={LayoutGrid}
        accent={settingsDash.warning}
        title={`${editChannelLabel} — ${t('hoursDayByDay')}`}
        description={t('hoursOverview')}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-xs"
            onClick={() =>
              copyEditWeekTo(STORE_HOURS_APPLY_CHANNELS.map((c) => c.key).filter((k) => k !== editChannel))
            }
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {t('hoursCopyWeekAll')}
          </button>
        </div>
        <div className="space-y-2">
          {STORE_HOURS_DAYS.map((d) => {
            const slots = editHours[d.key] || [];
            return (
              <div
                key={d.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/20 px-3 py-2 text-sm"
              >
                <span className="w-10 font-semibold">{d.label}</span>
                {slots.length === 0 ? (
                  <span className="text-[var(--text-muted)]">{t('reservationsClosedDay')}</span>
                ) : (
                  slots.map((slot, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1">
                      <input
                        type="time"
                        className="input w-auto py-1"
                        value={slot.open}
                        onChange={(e) => {
                          const next = cloneHoursSlots(slots);
                          next[idx] = { ...next[idx], open: e.target.value };
                          setEditDaySlots(d.key, next);
                        }}
                      />
                      <span>-</span>
                      <input
                        type="time"
                        className="input w-auto py-1"
                        value={slot.close}
                        onChange={(e) => {
                          const next = cloneHoursSlots(slots);
                          next[idx] = { ...next[idx], close: e.target.value };
                          setEditDaySlots(d.key, next);
                        }}
                      />
                    </span>
                  ))
                )}
                <button
                  type="button"
                  className="font-semibold text-teal-700"
                  onClick={() => setEditDaySlots(d.key, [...slots, { open: '17:00', close: '23:00' }])}
                >
                  +
                </button>
                <button
                  type="button"
                  className="font-semibold text-red-600"
                  onClick={() => setEditDaySlots(d.key, [])}
                >
                  {t('reservationsClosedDay')}
                </button>
              </div>
            );
          })}
        </div>
      </SettingsReportCard>

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-3">
        <button type="submit" className="btn-primary inline-flex items-center gap-2 sm:hidden" disabled={saving}>
          <Save className="h-4 w-4" aria-hidden />
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
