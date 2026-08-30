import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Copy, Plus, Save, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  STORE_HOURS_APPLY_CHANNELS,
  STORE_HOURS_DAYS,
  blocksToChannelHours,
  channelHoursToBlocks,
  cloneHoursSlots,
  emptyStoreHours,
  mergeStoreHours,
  newHoursScheduleBlock,
  normalizeScheduleBlocks,
  type ChannelHours,
  type HoursChannelKey,
  type HoursScheduleBlock,
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

function defaultDaySlots(): HoursSlot[] {
  return [
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ];
}

function mkWeekFromChannel(ch: ChannelHours): ChannelHours {
  return Object.fromEntries(
    STORE_HOURS_DAYS.map((d) => [d.key, cloneHoursSlots(ch[d.key] || [])])
  ) as ChannelHours;
}

type ChannelBlocksState = Record<HoursChannelKey, HoursScheduleBlock[]>;

function hoursToChannelBlocks(hours: StoreHours): ChannelBlocksState {
  const out = {} as ChannelBlocksState;
  for (const ch of ORDER_CHANNELS) {
    out[ch] = normalizeScheduleBlocks(channelHoursToBlocks(hours[ch]));
  }
  return out;
}

function channelBlocksToStoreHours(
  blocksByChannel: ChannelBlocksState,
  sameForAll: boolean
): StoreHours {
  const takeaway = blocksToChannelHours(blocksByChannel.takeaway);
  const next: StoreHours = { ...emptyStoreHours(), takeaway };
  if (sameForAll) {
    for (const ch of ORDER_CHANNELS) {
      next[ch] = mkWeekFromChannel(takeaway);
    }
  } else {
    for (const ch of ORDER_CHANNELS) {
      next[ch] = blocksToChannelHours(blocksByChannel[ch]);
    }
  }
  next.display = mkWeekFromChannel(takeaway);
  return next;
}

export default function SettingsHoursTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeChannel, setActiveChannel] = useState<HoursChannelKey>('takeaway');
  const [sameForAllChannels, setSameForAllChannels] = useState(true);
  const [blocksByChannel, setBlocksByChannel] = useState<ChannelBlocksState>(() =>
    hoursToChannelBlocks(emptyStoreHours())
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/settings');
      const merged = mergeStoreHours(res.data.settings?.storeHours);
      setBlocksByChannel(hoursToChannelBlocks(merged));
      const pickup = merged.takeaway || {};
      const dineIn = merged.dine_in || {};
      const delivery = merged.delivery || {};
      const same =
        JSON.stringify(pickup) === JSON.stringify(dineIn) &&
        JSON.stringify(pickup) === JSON.stringify(delivery);
      setSameForAllChannels(same);
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

  const activeBlocks = useMemo(
    () => blocksByChannel[activeChannel] || [],
    [blocksByChannel, activeChannel]
  );

  const setActiveBlocks = (nextBlocks: HoursScheduleBlock[]) => {
    const normalized = normalizeScheduleBlocks(nextBlocks);
    setBlocksByChannel((prev) => {
      if (sameForAllChannels) {
        const shared = {} as ChannelBlocksState;
        for (const ch of ORDER_CHANNELS) {
          shared[ch] = normalized.map((b) => ({
            ...b,
            id: `${b.id}-${ch}`,
            days: [...b.days],
            slots: cloneHoursSlots(b.slots),
          }));
        }
        return { ...prev, ...shared };
      }
      return { ...prev, [activeChannel]: normalized };
    });
  };

  const updateBlock = (blockId: string, patch: Partial<HoursScheduleBlock>) => {
    setActiveBlocks(
      activeBlocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    );
  };

  const toggleBlockDay = (blockId: string, day: StoreHoursDayKey) => {
    setActiveBlocks(
      activeBlocks.map((block) => {
        if (block.id !== blockId) {
          if (block.days.includes(day)) {
            return { ...block, days: block.days.filter((d) => d !== day) };
          }
          return block;
        }
        const has = block.days.includes(day);
        return {
          ...block,
          days: has ? block.days.filter((d) => d !== day) : [...block.days, day],
        };
      })
    );
  };

  const addScheduleBlock = () => {
    setActiveBlocks([...activeBlocks, newHoursScheduleBlock([], defaultDaySlots())]);
  };

  const removeScheduleBlock = (blockId: string) => {
    if (activeBlocks.length <= 1) {
      updateBlock(blockId, { slots: [], days: [] });
      return;
    }
    setActiveBlocks(activeBlocks.filter((b) => b.id !== blockId));
  };

  const applyWeekPreset = (preset: 'weekdays' | 'everyday' | 'closed') => {
    const days =
      preset === 'everyday'
        ? STORE_HOURS_DAYS.map((d) => d.key)
        : preset === 'weekdays'
          ? (['mon', 'tue', 'wed', 'thu', 'fri'] as StoreHoursDayKey[])
          : STORE_HOURS_DAYS.map((d) => d.key);
    const slots = preset === 'closed' ? [] : defaultDaySlots();
    setActiveBlocks([newHoursScheduleBlock(days, slots)]);
  };

  const toggleSameForAll = (on: boolean) => {
    setSameForAllChannels(on);
    if (on) {
      const source = blocksByChannel.takeaway;
      setBlocksByChannel((prev) => {
        const next = { ...prev };
        for (const ch of ORDER_CHANNELS) {
          next[ch] = source.map((b) => ({
            ...b,
            id: `${b.id}-sync-${ch}`,
            days: [...b.days],
            slots: cloneHoursSlots(b.slots),
          }));
        }
        return next;
      });
    }
  };

  const copyActiveToAll = () => {
    const source = blocksByChannel[activeChannel];
    setBlocksByChannel((prev) => {
      const next = { ...prev };
      for (const ch of ORDER_CHANNELS) {
        next[ch] = source.map((b) => ({
          ...b,
          id: `${b.id}-copy-${ch}-${Date.now()}`,
          days: [...b.days],
          slots: cloneHoursSlots(b.slots),
        }));
      }
      return next;
    });
    setSameForAllChannels(false);
    toast.success(t('hoursCopiedToAll'));
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = channelBlocksToStoreHours(blocksByChannel, sameForAllChannels);
      await api.put('/merchant/settings', { storeHours: payload });
      setBlocksByChannel(hoursToChannelBlocks(payload));
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
        subtitle={t('hoursEditorHint')}
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
        title={t('hoursEditorTitle')}
        description={t('hoursEditorDescription')}
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
          checked={sameForAllChannels}
          onChange={toggleSameForAll}
          title={t('hoursSameAllChannels')}
          hint={t('hoursSameAllChannelsHint')}
        />

        <div
          className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 p-1"
          role="tablist"
          aria-label={t('hoursOrderTypeTabs')}
        >
          {STORE_HOURS_APPLY_CHANNELS.filter((c) => c.key !== 'display').map((ch) => (
            <button
              key={ch.key}
              type="button"
              role="tab"
              aria-selected={activeChannel === ch.key}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                activeChannel === ch.key
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
              onClick={() => setActiveChannel(ch.key)}
            >
              {t(ch.labelKey)}
            </button>
          ))}
          {!sameForAllChannels ? (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-[var(--bg-elevated)]"
              onClick={copyActiveToAll}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {t('hoursCopyActiveChannel')}
            </button>
          ) : null}
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          {t(STORE_HOURS_APPLY_CHANNELS.find((c) => c.key === activeChannel)?.hintKey || 'hoursChannelPickupHint')}
        </p>

        <div className="space-y-4">
          {activeBlocks.map((block, blockIdx) => {
            const closed = block.slots.length === 0;
            return (
              <div
                key={block.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    {t('hoursScheduleBlock').replace('{n}', String(blockIdx + 1))}
                  </h3>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                    onClick={() => removeScheduleBlock(block.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {t('hoursRemoveBlock')}
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {t('hoursSelectDays')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STORE_HOURS_DAYS.map((d) => {
                      const selected = block.days.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          aria-pressed={selected}
                          className={`min-w-[2.75rem] rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                            selected
                              ? 'border-transparent bg-[var(--accent)] text-white'
                              : 'border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:border-[var(--accent)]'
                          }`}
                          onClick={() => toggleBlockDay(block.id, d.key)}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {t('hoursTimeSlots')}
                  </p>
                  {closed ? (
                    <p className="text-sm text-[var(--text-muted)]">{t('reservationsClosedDay')}</p>
                  ) : (
                    <div className="space-y-2">
                      {block.slots.map((slot, slotIdx) => (
                        <div key={slotIdx} className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            className="input w-auto py-1"
                            value={slot.open}
                            onChange={(e) => {
                              const next = cloneHoursSlots(block.slots);
                              next[slotIdx] = { ...next[slotIdx], open: e.target.value };
                              updateBlock(block.id, { slots: next });
                            }}
                          />
                          <span className="text-[var(--text-muted)]">–</span>
                          <input
                            type="time"
                            className="input w-auto py-1"
                            value={slot.close}
                            onChange={(e) => {
                              const next = cloneHoursSlots(block.slots);
                              next[slotIdx] = { ...next[slotIdx], close: e.target.value };
                              updateBlock(block.id, { slots: next });
                            }}
                          />
                          <button
                            type="button"
                            className="rounded p-1 text-red-600 hover:bg-[var(--bg-muted)]"
                            aria-label={t('remove')}
                            onClick={() => {
                              const next = block.slots.filter((_, i) => i !== slotIdx);
                              updateBlock(block.id, { slots: next });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-sm font-semibold text-teal-700"
                      onClick={() =>
                        updateBlock(block.id, {
                          slots: [...block.slots, { open: '17:00', close: '23:00' }],
                        })
                      }
                    >
                      + {t('hoursAddTimeSlot')}
                    </button>
                    {closed ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-teal-700"
                        onClick={() => updateBlock(block.id, { slots: defaultDaySlots() })}
                      >
                        {t('hoursBlockMarkOpen')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[var(--text-muted)]"
                        onClick={() => updateBlock(block.id, { slots: [] })}
                      >
                        {t('hoursBlockMarkClosed')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2 text-sm"
          onClick={addScheduleBlock}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('hoursAddScheduleBlock')}
        </button>

        {sameForAllChannels ? (
          <p className="text-sm text-[var(--text-muted)]">
            <Copy className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {t('hoursPosUsesPickup')}
          </p>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            {t('hoursPerChannelEditing')}
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
