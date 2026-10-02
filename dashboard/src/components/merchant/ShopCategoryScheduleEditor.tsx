export type ShopCategoryScheduleForm = {
  enabled: boolean;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  daysOfWeek: number[];
  daysOfMonth: number[];
  timeRanges: { start: string; end: string }[];
};

export const DEFAULT_SHOP_CATEGORY_SCHEDULE: ShopCategoryScheduleForm = {
  enabled: false,
  scheduleType: 'weekly',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  daysOfMonth: [],
  timeRanges: [{ start: '11:00', end: '14:00' }],
};

export function normalizeShopCategoryScheduleForm(raw: unknown): ShopCategoryScheduleForm {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SHOP_CATEGORY_SCHEDULE };
  }
  const o = raw as Record<string, unknown>;
  const scheduleType = (String(o.scheduleType || o.schedule_type || 'weekly') ||
    'weekly') as ShopCategoryScheduleForm['scheduleType'];
  const daysOfWeek = Array.isArray(o.daysOfWeek ?? o.days_of_week)
    ? ([...(o.daysOfWeek ?? o.days_of_week)] as number[])
    : DEFAULT_SHOP_CATEGORY_SCHEDULE.daysOfWeek;
  const daysOfMonth = Array.isArray(o.daysOfMonth ?? o.days_of_month)
    ? ([...(o.daysOfMonth ?? o.days_of_month)] as number[])
    : [];
  const timeRangesRaw = o.timeRanges ?? o.time_ranges;
  let timeRanges: ShopCategoryScheduleForm['timeRanges'];
  if (Array.isArray(timeRangesRaw) && timeRangesRaw.length) {
    timeRanges = timeRangesRaw.map((r) => {
      const row = r as { start?: string; end?: string };
      return {
        start: String(row.start || '00:00'),
        end: String(row.end || '23:59'),
      };
    });
  } else {
    timeRanges = [
      {
        start: typeof o.timeStart === 'string' ? o.timeStart : '00:00',
        end: typeof o.timeEnd === 'string' ? o.timeEnd : '23:59',
      },
    ];
  }
  return {
    enabled: o.enabled === true,
    scheduleType,
    daysOfWeek,
    daysOfMonth,
    timeRanges,
  };
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  value: ShopCategoryScheduleForm;
  onChange: (next: ShopCategoryScheduleForm) => void;
  t: (key: string) => string;
};

export default function ShopCategoryScheduleEditor({ value, onChange, t }: Props) {
  const toggleDay = (idx: number) => {
    const set = new Set(value.daysOfWeek);
    if (set.has(idx)) set.delete(idx);
    else set.add(idx);
    onChange({ ...value, daysOfWeek: [...set].sort((a, b) => a - b) });
  };

  const toggleDom = (d: number) => {
    const set = new Set(value.daysOfMonth);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({ ...value, daysOfMonth: [...set].sort((a, b) => a - b) });
  };

  const updateTimeRange = (idx: number, patch: Partial<{ start: string; end: string }>) => {
    onChange({
      ...value,
      timeRanges: value.timeRanges.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    });
  };

  const addTimeRange = () => {
    onChange({
      ...value,
      timeRanges: [...value.timeRanges, { start: '11:00', end: '14:00' }],
    });
  };

  const removeTimeRange = (idx: number) => {
    if (value.timeRanges.length <= 1) return;
    onChange({ ...value, timeRanges: value.timeRanges.filter((_, i) => i !== idx) });
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">{t('categoryShopScheduleTitle')}</p>
        <p className="text-xs muted mt-0.5">{t('categoryShopScheduleHint')}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        {t('categoryShopScheduleEnabled')}
      </label>
      {value.enabled ? (
        <>
          <label className="block text-sm">
            {t('scheduledMenuEffective')}
            <select
              className="input mt-1 w-full max-w-xs"
              value={value.scheduleType}
              onChange={(e) =>
                onChange({
                  ...value,
                  scheduleType: e.target.value as ShopCategoryScheduleForm['scheduleType'],
                })
              }
            >
              <option value="daily">{t('scheduledMenuDaily')}</option>
              <option value="weekly">{t('scheduledMenuWeekly')}</option>
              <option value="monthly">{t('scheduledMenuMonthly')}</option>
            </select>
          </label>
          {value.scheduleType === 'weekly' ? (
            <fieldset>
              <legend className="text-sm font-medium">{t('scheduledMenuDays')}</legend>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    className={`rounded px-2 py-1 text-xs border ${
                      value.daysOfWeek.includes(idx)
                        ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                        : 'border-[var(--border)]'
                    }`}
                    onClick={() => toggleDay(idx)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          {value.scheduleType === 'monthly' ? (
            <fieldset>
              <legend className="text-sm font-medium">{t('scheduledMenuDaysOfMonth')}</legend>
              <div className="grid grid-cols-7 gap-1 mt-1 max-w-md">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`rounded px-1 py-0.5 text-xs border ${
                      value.daysOfMonth.includes(d)
                        ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                        : 'border-[var(--border)]'
                    }`}
                    onClick={() => toggleDom(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="text-sm font-medium">{t('scheduledMenuTimeRanges')}</legend>
            <div className="space-y-2 mt-1">
              {value.timeRanges.map((range, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    className="input"
                    value={range.start}
                    onChange={(e) => updateTimeRange(idx, { start: e.target.value })}
                  />
                  <span className="text-sm">–</span>
                  <input
                    type="time"
                    className="input"
                    value={range.end}
                    onChange={(e) => updateTimeRange(idx, { end: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => removeTimeRange(idx)}
                    disabled={value.timeRanges.length <= 1}
                  >
                    {t('remove')}
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary text-xs" onClick={addTimeRange}>
                {t('scheduledMenuAddTimeRange')}
              </button>
            </div>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}
