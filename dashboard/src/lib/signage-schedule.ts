export type SignageScheduleWindow = {
  label?: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
};

export type SignageSchedule = {
  type: 'always' | 'weekdays' | 'daypart' | 'windows';
  weekdays?: number[];
  daypart?: 'lunch' | 'dinner';
  startTime?: string;
  endTime?: string;
  windows?: SignageScheduleWindow[];
};

export const SIGNAGE_WEEKDAYS = [
  { n: 1, key: 'signageMon' },
  { n: 2, key: 'signageTue' },
  { n: 3, key: 'signageWed' },
  { n: 4, key: 'signageThu' },
  { n: 5, key: 'signageFri' },
  { n: 6, key: 'signageSat' },
  { n: 7, key: 'signageSun' },
] as const;

export function defaultScheduleWindow(preset: 'lunch' | 'dinner' = 'lunch'): SignageScheduleWindow {
  return preset === 'dinner'
    ? { label: 'Dinner', weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '17:00', endTime: '22:00' }
    : { label: 'Lunch', weekdays: [1, 2, 3, 4, 5], startTime: '11:00', endTime: '14:30' };
}

export function scheduleSummaryKey(schedule: SignageSchedule | null | undefined): string {
  const s = schedule || { type: 'always' as const };
  if (s.type === 'windows') return 'signageScheduleWindows';
  if (s.type === 'weekdays') return 'signageScheduleWeekdays';
  if (s.type === 'daypart') return 'signageScheduleDaypart';
  return 'signageScheduleAlways';
}
