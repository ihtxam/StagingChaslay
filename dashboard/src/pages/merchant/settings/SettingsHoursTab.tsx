import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
    return <div className="p-4 text-sm muted">{t('loading')}</div>;
  }

  const editHours = hours[editChannel] || {};
  const editChannelLabel = channelLabel(editChannel);

  return (
    <form onSubmit={onSave} className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t('settingsHours')}</h2>
        <p className="page-sub mt-1">{t('settingsHoursHint')}</p>
        <p className="text-xs muted mt-2">{t('shopHoursNavPos')}</p>
      </div>

      <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/40 p-4 space-y-4">
        <div>
          <span className="text-sm font-medium block mb-2">{t('hoursEditingFor')}</span>
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] p-1">
            {STORE_HOURS_APPLY_CHANNELS.map((opt) => {
              const on = editChannel === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectEditChannel(opt.key)}
                  className={`flex-1 min-w-[6.5rem] rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    on
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] muted mt-2 leading-snug">
            {t('hoursEditingHint').replace('{channel}', editChannelLabel)}
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium">{t('hoursQuickDays')}</span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button type="button" className="px-2 py-1 rounded border bg-[var(--bg)]" onClick={() => selectPresetDays('all')}>
                {t('hoursAllWeek')}
              </button>
              <button type="button" className="px-2 py-1 rounded border bg-[var(--bg)]" onClick={() => selectPresetDays('weekdays')}>
                {t('hoursWeekdays')}
              </button>
              <button type="button" className="px-2 py-1 rounded border bg-[var(--bg)]" onClick={() => selectPresetDays('weekend')}>
                {t('hoursWeekend')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {STORE_HOURS_DAYS.map((d) => {
              const on = selectedDays.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`min-w-[2.75rem] px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                    on
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-[var(--bg)] text-stone-600 border-[var(--border)] hover:border-stone-400'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium">{t('hoursRanges')}</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border bg-[var(--bg)]"
                onClick={() =>
                  setDraftSlots([
                    { open: '11:00', close: '14:00' },
                    { open: '17:00', close: '23:00' },
                  ])
                }
              >
                {t('hoursLunchDinner')}
              </button>
              <label className="flex items-center gap-2 text-sm muted">
                <input type="checkbox" checked={markClosed} onChange={(e) => setMarkClosed(e.target.checked)} />
                {t('hoursMarkClosed')}
              </label>
            </div>
          </div>
          {!markClosed && (
            <div className="space-y-2">
              {draftSlots.map((slot, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input type="time" className="input w-auto" value={slot.open} onChange={(e) => updateDraftSlot(idx, 'open', e.target.value)} />
                  <span className="text-stone-400">{t('hoursTo')}</span>
                  <input type="time" className="input w-auto" value={slot.close} onChange={(e) => updateDraftSlot(idx, 'close', e.target.value)} />
                  {draftSlots.length > 1 ? (
                    <button type="button" className="text-sm text-red-600" onClick={() => setDraftSlots((prev) => prev.filter((_, i) => i !== idx))}>
                      {t('remove')}
                    </button>
                  ) : null}
                </div>
              ))}
              <button type="button" className="text-sm font-medium text-teal-700" onClick={() => setDraftSlots((prev) => [...prev, { open: '17:00', close: '23:00' }])}>
                {t('hoursAddRange')}
              </button>
            </div>
          )}
        </div>

        <div>
          <span className="text-sm font-medium block mb-2">{t('hoursAlsoApply')}</span>
          <div className="flex flex-wrap gap-2">
            {STORE_HOURS_APPLY_CHANNELS.filter((c) => c.key !== editChannel).map((opt) => {
              const on = alsoCopyTo.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleAlsoCopyTo(opt.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                    on ? 'border-slate-900 bg-[var(--bg)] shadow-sm font-semibold' : 'border-[var(--border)] bg-[var(--bg)]/70 text-stone-600'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className="btn-secondary" onClick={applyQuickSchedule}>
          {t('hoursApplyQuick')}
        </button>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide muted">
              {editChannelLabel} — {t('hoursDayByDay')}
            </p>
            <button
              type="button"
              className="px-2 py-1 rounded border text-xs bg-[var(--bg-muted)]"
              onClick={() =>
                copyEditWeekTo(STORE_HOURS_APPLY_CHANNELS.map((c) => c.key).filter((k) => k !== editChannel))
              }
            >
              {t('hoursCopyWeekAll')}
            </button>
          </div>
          <div className="space-y-2">
            {STORE_HOURS_DAYS.map((d) => {
              const slots = editHours[d.key] || [];
              return (
                <div key={d.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-10 font-medium">{d.label}</span>
                  {slots.length === 0 ? (
                    <span className="muted">{t('reservationsClosedDay')}</span>
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
                  <button type="button" className="text-teal-700" onClick={() => setEditDaySlots(d.key, [...slots, { open: '17:00', close: '23:00' }])}>
                    +
                  </button>
                  <button type="button" className="text-red-600" onClick={() => setEditDaySlots(d.key, [])}>
                    {t('reservationsClosedDay')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide muted">{t('hoursOverview')}</p>
          {STORE_HOURS_APPLY_CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => selectEditChannel(c.key)}
              className={`w-full text-left text-sm flex flex-col sm:flex-row sm:gap-2 rounded-md px-2 py-1.5 transition ${
                editChannel === c.key ? 'bg-[var(--bg-muted)]' : 'hover:bg-stone-50'
              }`}
            >
              <span className="font-medium sm:w-36 shrink-0">{t(c.labelKey)}</span>
              <span className="muted">{summarizeChannelHours(hours[c.key] || {})}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end border-t border-[var(--border)] pt-4">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
