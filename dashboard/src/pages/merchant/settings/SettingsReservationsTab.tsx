import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { STORE_HOURS_DAYS } from '@/lib/store-hours';

type DayKey = (typeof STORE_HOURS_DAYS)[number]['key'];
type HoursSlot = { open: string; close: string };
type ChannelHours = Partial<Record<DayKey, HoursSlot[]>>;

type ResSettings = {
  dineInHoursMode: 'same_as_takeaway' | 'custom';
  slotIntervalMinutes: number;
  seatingDurationMinutes: number;
  bufferMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  minHoursBefore: number;
  maxDaysAhead: number;
  autoAccept: boolean;
  sendConfirmationEmail: boolean;
  sendStatusEmails: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  sendReminderEmail: boolean;
  notifyAdminEmail: boolean;
  dailySummaryEnabled: boolean;
  maxCoversPerSlot: number | null;
  policiesText: string | null;
  slotDiscounts: Array<{
    id: string;
    name: string;
    percentOff: number;
    scheduleMode: 'specific_days' | 'whole_week';
    daysOfWeek: string[];
    timeStart?: string | null;
    timeEnd?: string | null;
    enabled?: boolean;
  }>;
};

function emptyWeek(): ChannelHours {
  const w: ChannelHours = {};
  for (const d of STORE_HOURS_DAYS) {
    w[d.key] = [
      { open: '11:00', close: '14:00' },
      { open: '17:00', close: '22:00' },
    ];
  }
  return w;
}

export default function SettingsReservationsTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<ResSettings | null>(null);
  const [dineInHours, setDineInHours] = useState<ChannelHours>(emptyWeek());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/reservations/config');
      setEnabled(!!res.data.config?.enabled);
      setSettings(res.data.config?.settings);
      if (res.data.config?.hours) setDineInHours(res.data.config.hours);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.put('/merchant/reservations/config', {
        enabled,
        settings,
        dineInHours: settings.dineInHoursMode === 'custom' ? dineInHours : undefined,
      });
      setEnabled(!!res.data.config?.enabled);
      setSettings(res.data.config?.settings);
      if (res.data.config?.hours) setDineInHours(res.data.config.hours);
      toast.success(t('saved'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-4 text-sm muted">{t('loading')}</div>;
  }

  return (
    <form onSubmit={saveSettings} className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t('settingsReservations')}</h2>
        <p className="page-sub mt-1">{t('settingsReservationsHint')}</p>
      </div>

      <div className="space-y-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t('reservationsEnable')}
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsHoursMode')}</span>
            <select
              className="input"
              value={settings.dineInHoursMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dineInHoursMode: e.target.value as ResSettings['dineInHoursMode'],
                })
              }
            >
              <option value="same_as_takeaway">{t('reservationsSameAsTakeaway')}</option>
              <option value="custom">{t('reservationsCustomHours')}</option>
            </select>
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsSlotInterval')}</span>
            <select
              className="input"
              value={settings.slotIntervalMinutes}
              onChange={(e) =>
                setSettings({ ...settings, slotIntervalMinutes: Number(e.target.value) })
              }
            >
              {[15, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsSeatingDuration')}</span>
            <input
              type="number"
              min={30}
              max={360}
              className="input"
              value={settings.seatingDurationMinutes}
              onChange={(e) =>
                setSettings({ ...settings, seatingDurationMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsBuffer')}</span>
            <input
              type="number"
              min={0}
              max={120}
              className="input"
              value={settings.bufferMinutes}
              onChange={(e) => setSettings({ ...settings, bufferMinutes: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsMinHoursBefore')}</span>
            <input
              type="number"
              min={0}
              max={72}
              className="input"
              value={settings.minHoursBefore}
              onChange={(e) => setSettings({ ...settings, minHoursBefore: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsMaxDaysAhead')}</span>
            <input
              type="number"
              min={1}
              max={180}
              className="input"
              value={settings.maxDaysAhead}
              onChange={(e) => setSettings({ ...settings, maxDaysAhead: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsMinParty')}</span>
            <input
              type="number"
              min={1}
              className="input"
              value={settings.minPartySize}
              onChange={(e) => setSettings({ ...settings, minPartySize: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsMaxParty')}</span>
            <input
              type="number"
              min={1}
              className="input"
              value={settings.maxPartySize}
              onChange={(e) => setSettings({ ...settings, maxPartySize: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsMaxCovers')}</span>
            <input
              type="number"
              min={0}
              className="input"
              placeholder={t('reservationsMaxCoversAuto')}
              value={settings.maxCoversPerSlot ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxCoversPerSlot: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoAccept}
              onChange={(e) => setSettings({ ...settings, autoAccept: e.target.checked })}
            />
            {t('reservationsAutoAccept')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sendConfirmationEmail}
              onChange={(e) =>
                setSettings({ ...settings, sendConfirmationEmail: e.target.checked })
              }
            />
            {t('reservationsSendConfirmEmail')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.notifyAdminEmail !== false}
              onChange={(e) => setSettings({ ...settings, notifyAdminEmail: e.target.checked })}
            />
            {t('reservationsNotifyAdmin')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sendStatusEmails}
              onChange={(e) => setSettings({ ...settings, sendStatusEmails: e.target.checked })}
            />
            {t('reservationsSendStatusEmails')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.reminderEnabled !== false}
              onChange={(e) => setSettings({ ...settings, reminderEnabled: e.target.checked })}
            />
            {t('reservationsReminderEnabled')}
          </label>
          {settings.reminderEnabled !== false ? (
            <label className="text-sm flex items-center gap-2 flex-wrap">
              <span className="muted">{t('reservationsRemind')}</span>
              <input
                className="input !w-20"
                type="number"
                min={1}
                max={168}
                value={settings.reminderHoursBefore ?? 24}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    reminderHoursBefore: Number(e.target.value) || 24,
                  })
                }
              />
              <span className="muted">{t('reservationsRemindBefore')}</span>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.dailySummaryEnabled !== false}
              onChange={(e) =>
                setSettings({ ...settings, dailySummaryEnabled: e.target.checked })
              }
            />
            {t('reservationsDailySummary')}
          </label>
        </div>

        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t('reservationsSlotDiscounts')}</h3>
              <p className="text-xs muted">{t('reservationsSlotDiscountsHint')}</p>
            </div>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() =>
                setSettings({
                  ...settings,
                  slotDiscounts: [
                    ...(settings.slotDiscounts || []),
                    {
                      id: `disc-${Date.now()}`,
                      name: 'Off-peak 20%',
                      percentOff: 20,
                      scheduleMode: 'whole_week',
                      daysOfWeek: [],
                      timeStart: '13:00',
                      timeEnd: '17:00',
                      enabled: true,
                    },
                  ],
                })
              }
            >
              {t('reservationsAddDiscount')}
            </button>
          </div>
          {(settings.slotDiscounts || []).map((d, idx) => (
            <div
              key={d.id}
              className="rounded-lg border border-[var(--border)] p-3 space-y-2 bg-[var(--bg-muted)]/40"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  className="input"
                  value={d.name}
                  onChange={(e) => {
                    const next = [...(settings.slotDiscounts || [])];
                    next[idx] = { ...d, name: e.target.value };
                    setSettings({ ...settings, slotDiscounts: next });
                  }}
                  placeholder={t('name')}
                />
                <label className="text-sm flex items-center gap-1">
                  <input
                    className="input !w-20"
                    type="number"
                    min={1}
                    max={90}
                    value={d.percentOff}
                    onChange={(e) => {
                      const next = [...(settings.slotDiscounts || [])];
                      next[idx] = { ...d, percentOff: Number(e.target.value) || 0 };
                      setSettings({ ...settings, slotDiscounts: next });
                    }}
                  />
                  % off
                </label>
                <select
                  className="input"
                  value={d.scheduleMode || 'specific_days'}
                  onChange={(e) => {
                    const next = [...(settings.slotDiscounts || [])];
                    next[idx] = {
                      ...d,
                      scheduleMode: e.target.value as 'specific_days' | 'whole_week',
                    };
                    setSettings({ ...settings, slotDiscounts: next });
                  }}
                >
                  <option value="whole_week">{t('reservationsWholeWeek')}</option>
                  <option value="specific_days">{t('reservationsCertainDays')}</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      slotDiscounts: (settings.slotDiscounts || []).filter((_, i) => i !== idx),
                    })
                  }
                >
                  {t('remove')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="time"
                  className="input !w-auto"
                  value={d.timeStart || ''}
                  onChange={(e) => {
                    const next = [...(settings.slotDiscounts || [])];
                    next[idx] = { ...d, timeStart: e.target.value || null };
                    setSettings({ ...settings, slotDiscounts: next });
                  }}
                />
                <span>-</span>
                <input
                  type="time"
                  className="input !w-auto"
                  value={d.timeEnd || ''}
                  onChange={(e) => {
                    const next = [...(settings.slotDiscounts || [])];
                    next[idx] = { ...d, timeEnd: e.target.value || null };
                    setSettings({ ...settings, slotDiscounts: next });
                  }}
                />
                <span className="text-xs muted">{t('reservationsEmptyTimesHint')}</span>
              </div>
              {d.scheduleMode !== 'whole_week' ? (
                <div className="flex flex-wrap gap-1">
                  {STORE_HOURS_DAYS.map((day) => {
                    const on = (d.daysOfWeek || []).includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        className={`rounded-full px-2 py-0.5 text-[11px] border ${
                          on
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white border-[var(--border)]'
                        }`}
                        onClick={() => {
                          const days = new Set(d.daysOfWeek || []);
                          if (on) days.delete(day.key);
                          else days.add(day.key);
                          const next = [...(settings.slotDiscounts || [])];
                          next[idx] = { ...d, daysOfWeek: [...days] };
                          setSettings({ ...settings, slotDiscounts: next });
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <label className="text-sm block">
          <span className="muted block mb-1">{t('reservationsPolicies')}</span>
          <textarea
            className="input min-h-24"
            value={settings.policiesText || ''}
            onChange={(e) => setSettings({ ...settings, policiesText: e.target.value || null })}
          />
        </label>

        {settings.dineInHoursMode === 'custom' && (
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-semibold">{t('reservationsCustomHours')}</h3>
            <p className="text-xs muted">{t('reservationsCustomHoursHint')}</p>
            {STORE_HOURS_DAYS.map((day) => (
              <div key={day.key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-10 font-medium">{day.label}</span>
                {(dineInHours[day.key] || []).map((slot, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <input
                      type="time"
                      className="input !w-auto"
                      value={slot.open}
                      onChange={(e) => {
                        const next = { ...dineInHours };
                        const slots = [...(next[day.key] || [])];
                        slots[idx] = { ...slots[idx], open: e.target.value };
                        next[day.key] = slots;
                        setDineInHours(next);
                      }}
                    />
                    <span>-</span>
                    <input
                      type="time"
                      className="input !w-auto"
                      value={slot.close}
                      onChange={(e) => {
                        const next = { ...dineInHours };
                        const slots = [...(next[day.key] || [])];
                        slots[idx] = { ...slots[idx], close: e.target.value };
                        next[day.key] = slots;
                        setDineInHours(next);
                      }}
                    />
                  </span>
                ))}
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => {
                    const next = { ...dineInHours };
                    next[day.key] = [...(next[day.key] || []), { open: '18:00', close: '22:00' }];
                    setDineInHours(next);
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  className="text-xs muted"
                  onClick={() => {
                    const next = { ...dineInHours };
                    next[day.key] = [];
                    setDineInHours(next);
                  }}
                >
                  {t('reservationsClosedDay')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-[var(--border)] pt-4">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
