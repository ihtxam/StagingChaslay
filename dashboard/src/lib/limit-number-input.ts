/** Number inputs that allow an empty field while the user is typing. */
export type LimitNumberField = number | '';

export function limitNumberToField(value: number | null | undefined): LimitNumberField {
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

export function parseLimitNumberField(value: LimitNumberField, fallback: number): number {
  if (value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(99, Math.trunc(n)));
}

export function handleLimitNumberInputChange(
  raw: string,
  onValue: (value: LimitNumberField) => void
): void {
  if (raw === '') {
    onValue('');
    return;
  }
  if (!/^\d+$/.test(raw)) return;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 99) return;
  onValue(n);
}

export function limitNumberInputDisplay(value: LimitNumberField): string | number {
  return value === '' ? '' : value;
}
