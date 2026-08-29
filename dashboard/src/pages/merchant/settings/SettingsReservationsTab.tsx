import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bell,
  CalendarClock,
  Percent,
  Save,
  Settings2,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { STORE_HOURS_DAYS } from '@/lib/store-hours';
import {
  settingsDash,
  SettingsField,
  SettingsKpiCard,
  SettingsKpiGrid,
  SettingsPageHeader,
  SettingsReportCard,
  SettingsToggleRow,
} from '@/components/settings/SettingsReportUi';

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
  autoPrintReservations?: boolean;
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
    return <div className="p-4 text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  const discountCount = settings.slotDiscounts?.length ?? 0;

  return (
    <form onSubmit={saveSettings} className="space-y-5">
      <SettingsPageHeader
        title={t('settingsReservations')}
        subtitle={t('settingsReservationsHint')}
        action={
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? t('saving') : t('save')}
          </button>
        }
      />

      <SettingsKpiGrid>
        <SettingsKpiCard
          icon={CalendarClock}
          accent={settingsDash.accent}
          label={t('reservationsEnable')}
          value={enabled ? t('status') : '—'}
        />
        <SettingsKpiCard
          icon={Settings2}
          accent={settingsDash.info}
          label={t('reservationsSlotInterval')}
          value={`${settings.slotIntervalMinutes} min`}
        />
        <SettingsKpiCard
          icon={Users}
          accent={settingsDash.warning}
          label={t('reservationsMinParty')}
          value={`${settings.minPartySize}–${settings.maxPartySize}`}
        />
        <SettingsKpiCard
          icon={Percent}
          accent={settingsDash.success}
          label={t('reservationsSlotDiscounts')}
          value={String(discountCount)}
          muted={discountCount === 0}
        />
      </SettingsKpiGrid>

      <SettingsReportCard
        icon={CalendarClock}
        accent={settingsDash.accent}
        title={t('reservationsEnable')}
        description={t('settingsReservationsHint')}
      >
        <SettingsToggleRow
          checked={enabled}
          onChange={setEnabled}
          title={t('reservationsEnable')}
        />
      </SettingsReportCard>

      <SettingsReportCard
        icon={Settings2}
        accent={settingsDash.info}
        title={t('reservationsHoursMode')}
        description={t('reservationsCustomHoursHint')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField label={t('reservationsHoursMode')}>
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
          </SettingsField>
          <SettingsField label={t('reservationsSlotInterval')}>
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
          </SettingsField>
          <SettingsField label={t('reservationsSeatingDuration')}>
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
          </SettingsField>
          <SettingsField label={t('reservationsBuffer')}>
            <input
              type="number"
              min={0}
              max={120}
              className="input"
              value={settings.bufferMinutes}
              onChange={(e) => setSettings({ ...settings, bufferMinutes: Number(e.target.value) })}
            />
          </SettingsField>
          <SettingsField label={t('reservationsMinHoursBefore')}>
            <input
              type="number"
              min={0}
              max={72}
              className="input"
              value={settings.minHoursBefore}
              onChange={(e) => setSettings({ ...settings, minHoursBefore: Number(e.target.value) })}
            />
          </SettingsField>
          <SettingsField label={t('reservationsMaxDaysAhead')}>
            <input
              type="number"
              min={1}
              max={180}
              className="input"
              value={settings.maxDaysAhead}
              onChange={(e) => setSettings({ ...settings, maxDaysAhead: Number(e.target.value) })}
            />
          </SettingsField>
          <SettingsField label={t('reservationsMinParty')}>
            <input
              type="number"
              min={1}
              className="input"
              value={settings.minPartySize}
              onChange={(e) => setSettings({ ...settings, minPartySize: Number(e.target.value) })}
            />
          </SettingsField>
          <SettingsField label={t('reservationsMaxParty')}>
            <input
              type="number"
              min={1}
              className="input"
              value={settings.maxPartySize}
              onChange={(e) => setSettings({ ...settings, maxPartySize: Number(e.target.value) })}
            />
          </SettingsField>
          <SettingsField label={t('reservationsMaxCovers')}>
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
          </SettingsField>
        </div>
      </SettingsReportCard>

      <SettingsReportCard
        icon={Bell}
        accent={settingsDash.warning}
        title={t('reservationsSendConfirmEmail')}
        description={t('reservationsNotifyAdmin')}
      >
        <div className="space-y-2">
          <SettingsToggleRow
            checked={settings.autoAccept}
            onChange={(autoAccept) => setSettings({ ...settings, autoAccept })}
            title={t('reservationsAutoAccept')}
          />
          <SettingsToggleRow
            checked={settings.autoPrintReservations !== false}
            onChange={(autoPrintReservations) =>
              setSettings({ ...settings, autoPrintReservations })
            }
            title={t('autoPrintReservations')}
          />
          <SettingsToggleRow
            checked={settings.sendConfirmationEmail}
            onChange={(sendConfirmationEmail) =>
              setSettings({ ...settings, sendConfirmationEmail })
            }
            title={t('reservationsSendConfirmEmail')}
          />
          <SettingsToggleRow
            checked={settings.notifyAdminEmail !== false}
            onChange={(notifyAdminEmail) => setSettings({ ...settings, notifyAdminEmail })}
            title={t('reservationsNotifyAdmin')}
          />
          <SettingsToggleRow
            checked={settings.sendStatusEmails}
            onChange={(sendStatusEmails) => setSettings({ ...settings, sendStatusEmails })}
            title={t('reservationsSendStatusEmails')}
          />
          <SettingsToggleRow
            checked={settings.reminderEnabled !== false}
            onChange={(reminderEnabled) => setSettings({ ...settings, reminderEnabled })}
            title={t('reservationsReminderEnabled')}
          />
          {settings.reminderEnabled !== false ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/25 px-3.5 py-3 text-sm">
              <span className="text-[var(--text-muted)]">{t('reservationsRemind')}</span>
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
              <span className="text-[var(--text-muted)]">{t('reservationsRemindBefore')}</span>
            </div>
          ) : null}
          <SettingsToggleRow
            checked={settings.dailySummaryEnabled !== false}
            onChange={(dailySummaryEnabled) =>
              setSettings({ ...settings, dailySummaryEnabled })
            }
            title={t('reservationsDailySummary')}
          />
        </div>
      </SettingsReportCard>

      <SettingsReportCard
        icon={Percent}
        accent={settingsDash.success}
        title={t('reservationsSlotDiscounts')}
        description={t('reservationsSlotDiscountsHint')}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
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
            className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3.5"
          >
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
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
              <label className="flex items-center gap-1 text-sm">
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
            <div className="flex flex-wrap items-center gap-2">
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
              <span className="text-xs text-[var(--text-muted)]">{t('reservationsEmptyTimesHint')}</span>
            </div>
            {d.scheduleMode !== 'whole_week' ? (
              <div className="flex flex-wrap gap-1">
                {STORE_HOURS_DAYS.map((day) => {
                  const on = (d.daysOfWeek || []).includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        on
                          ? 'border-amber-700 bg-amber-700 text-white'
                          : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
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
      </SettingsReportCard>

      <SettingsReportCard
        icon={CalendarClock}
        accent={settingsDash.danger}
        title={t('reservationsPolicies')}
        description={t('reservationsCustomHoursHint')}
      >
        <SettingsField label={t('reservationsPolicies')}>
          <textarea
            className="input min-h-24"
            value={settings.policiesText || ''}
            onChange={(e) => setSettings({ ...settings, policiesText: e.target.value || null })}
          />
        </SettingsField>

        {settings.dineInHoursMode === 'custom' && (
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-extrabold tracking-tight">{t('reservationsCustomHours')}</p>
            {STORE_HOURS_DAYS.map((day) => (
              <div
                key={day.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/20 px-3 py-2 text-sm"
              >
                <span className="w-10 font-semibold">{day.label}</span>
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
                  className="text-xs font-semibold text-teal-700 underline underline-offset-2"
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
                  className="text-xs text-[var(--text-muted)]"
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
