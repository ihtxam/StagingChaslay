import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  SIGNAGE_WEEKDAYS,
  defaultScheduleWindow,
  type SignageSchedule,
  type SignageScheduleWindow,
} from '@/lib/signage-schedule';

type Props = {
  scheduleType: SignageSchedule['type'];
  onScheduleTypeChange: (type: SignageSchedule['type']) => void;
  weekdays: number[];
  onWeekdaysChange: (days: number[]) => void;
  daypart: 'lunch' | 'dinner';
  onDaypartChange: (v: 'lunch' | 'dinner') => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (v: string) => void;
  onEndTimeChange: (v: string) => void;
  windows: SignageScheduleWindow[];
  onWindowsChange: (windows: SignageScheduleWindow[]) => void;
};

export function buildScheduleFromEditor(props: Pick<
  Props,
  'scheduleType' | 'weekdays' | 'daypart' | 'startTime' | 'endTime' | 'windows'
>): SignageSchedule {
  if (props.scheduleType === 'weekdays') return { type: 'weekdays', weekdays: props.weekdays };
  if (props.scheduleType === 'daypart') {
    return { type: 'daypart', daypart: props.daypart, startTime: props.startTime, endTime: props.endTime };
  }
  if (props.scheduleType === 'windows') {
    const windows = props.windows.filter((w) => w.weekdays.length > 0);
    return windows.length ? { type: 'windows', windows } : { type: 'always' };
  }
  return { type: 'always' };
}

export function scheduleEditorStateFromSchedule(schedule: SignageSchedule | null | undefined) {
  const s = schedule || { type: 'always' as const };
  return {
    scheduleType: s.type || ('always' as const),
    weekdays: s.weekdays?.length ? s.weekdays : [1, 2, 3, 4, 5],
    daypart: s.daypart === 'dinner' ? ('dinner' as const) : ('lunch' as const),
    startTime: s.startTime || (s.daypart === 'dinner' ? '17:00' : '11:00'),
    endTime: s.endTime || (s.daypart === 'dinner' ? '22:00' : '14:30'),
    windows: s.windows?.length ? s.windows : [defaultScheduleWindow('lunch'), defaultScheduleWindow('dinner')],
  };
}

export default function SignageScheduleEditor({
  scheduleType,
  onScheduleTypeChange,
  weekdays,
  onWeekdaysChange,
  daypart,
  onDaypartChange,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  windows,
  onWindowsChange,
}: Props) {
  const { t } = useI18n();

  const toggleWeekday = (days: number[], n: number) =>
    days.includes(n) ? days.filter((d) => d !== n) : [...days, n];

  const patchWindow = (idx: number, patch: Partial<SignageScheduleWindow>) => {
    onWindowsChange(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        {t('signageSchedule')}
        <select
          className="input mt-1 w-full"
          value={scheduleType}
          onChange={(e) => {
            const v = e.target.value;
            onScheduleTypeChange(
              v === 'weekdays' || v === 'daypart' || v === 'windows' ? v : 'always'
            );
          }}
        >
          <option value="always">{t('signageScheduleAlways')}</option>
          <option value="weekdays">{t('signageScheduleWeekdays')}</option>
          <option value="daypart">{t('signageScheduleDaypart')}</option>
          <option value="windows">{t('signageScheduleWindows')}</option>
        </select>
      </label>

      {scheduleType === 'weekdays' ? (
        <div className="flex flex-wrap gap-2">
          {SIGNAGE_WEEKDAYS.map((d) => (
            <button
              key={d.n}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                weekdays.includes(d.n) ? 'bg-teal-600 text-white' : 'bg-stone-100'
              }`}
              onClick={() => onWeekdaysChange(toggleWeekday(weekdays, d.n))}
            >
              {t(d.key)}
            </button>
          ))}
        </div>
      ) : null}

      {scheduleType === 'daypart' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="input"
            value={daypart}
            onChange={(e) => {
              const next = e.target.value === 'dinner' ? 'dinner' : 'lunch';
              onDaypartChange(next);
              if (next === 'dinner') {
                onStartTimeChange('17:00');
                onEndTimeChange('22:00');
              } else {
                onStartTimeChange('11:00');
                onEndTimeChange('14:30');
              }
            }}
          >
            <option value="lunch">{t('signageLunch')}</option>
            <option value="dinner">{t('signageDinner')}</option>
          </select>
          <input className="input" type="time" value={startTime} onChange={(e) => onStartTimeChange(e.target.value)} />
          <input className="input" type="time" value={endTime} onChange={(e) => onEndTimeChange(e.target.value)} />
        </div>
      ) : null}

      {scheduleType === 'windows' ? (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">{t('signageScheduleWindowsHint')}</p>
          {windows.map((w, idx) => (
            <div key={idx} className="rounded-lg border border-stone-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder={t('signageScheduleWindowLabel')}
                  value={w.label || ''}
                  onChange={(e) => patchWindow(idx, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title={t('delete')}
                  disabled={windows.length <= 1}
                  onClick={() => onWindowsChange(windows.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SIGNAGE_WEEKDAYS.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                      w.weekdays.includes(d.n) ? 'bg-teal-600 text-white' : 'bg-stone-100'
                    }`}
                    onClick={() => patchWindow(idx, { weekdays: toggleWeekday(w.weekdays, d.n) })}
                  >
                    {t(d.key)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  {t('signageStartTime')}
                  <input
                    className="input mt-1"
                    type="time"
                    value={w.startTime}
                    onChange={(e) => patchWindow(idx, { startTime: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  {t('signageEndTime')}
                  <input
                    className="input mt-1"
                    type="time"
                    value={w.endTime}
                    onChange={(e) => patchWindow(idx, { endTime: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary text-xs inline-flex items-center gap-1"
            onClick={() => onWindowsChange([...windows, defaultScheduleWindow('lunch')])}
          >
            <Plus className="h-3.5 w-3.5" /> {t('signageAddScheduleWindow')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
