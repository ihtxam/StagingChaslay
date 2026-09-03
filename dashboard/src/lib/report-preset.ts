import { addDaysYmdZurich, ymdZurich } from '@/lib/date-format';

export type ReportPreset =
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'custom';

/** Mirrors backend `resolveReportRange` (Europe/Zurich calendar days). */
export function resolveReportPresetRange(
  preset: ReportPreset,
  from?: string,
  to?: string
): { from: string; to: string; label: string } {
  const today = ymdZurich();
  if (preset === 'custom') {
    const f = (from || today).slice(0, 10);
    const t = (to || f).slice(0, 10);
    return { from: f, to: t, label: `${f} to ${t}` };
  }
  if (preset === 'yesterday') {
    const y = addDaysYmdZurich(-1);
    return { from: y, to: y, label: y };
  }
  if (preset === 'last_week') {
    const f = addDaysYmdZurich(-6);
    return { from: f, to: today, label: `${f} to ${today}` };
  }
  if (preset === 'this_month') {
    const f = `${today.slice(0, 7)}-01`;
    return { from: f, to: today, label: `${f} to ${today}` };
  }
  if (preset === 'last_month') {
    const f = addDaysYmdZurich(-29);
    return { from: f, to: today, label: `${f} to ${today}` };
  }
  if (preset === 'last_3_months') {
    const f = addDaysYmdZurich(-89);
    return { from: f, to: today, label: `${f} to ${today}` };
  }
  return { from: today, to: today, label: today };
}

export const REPORT_PRESET_IDS: ReportPreset[] = [
  'today',
  'yesterday',
  'last_week',
  'this_month',
  'last_month',
  'last_3_months',
  'custom',
];
