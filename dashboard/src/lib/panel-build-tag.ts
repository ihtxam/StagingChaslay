/** `vDDMMYY.N` in Europe/Zurich (CET/CEST), used as the dated panel build suffix. */
export function formatPanelDatedBuildTag(date: Date, sequence: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const year = parts.find((p) => p.type === 'year')?.value ?? '00';
  const seq = Number.isFinite(sequence) && sequence > 0 ? Math.floor(sequence) : 1;
  return `v${day}${month}${year}.${seq}`;
}

/** Day key `DDMMYY` in Europe/Zurich for same-day rebuild counters. */
export function panelBuildDayKey(date: Date): string {
  const tag = formatPanelDatedBuildTag(date, 1);
  return tag.slice(1, 7);
}
