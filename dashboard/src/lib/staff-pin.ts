/** Staff POS PIN length (matches backend StaffService + Android POS). */
export const STAFF_PIN_MIN_LENGTH = 4;
export const STAFF_PIN_MAX_LENGTH = 8;

export function sanitizeStaffPinInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, STAFF_PIN_MAX_LENGTH);
}

export function isValidStaffPin(pin: string): boolean {
  const trimmed = pin.trim();
  return (
    /^\d+$/.test(trimmed) &&
    trimmed.length >= STAFF_PIN_MIN_LENGTH &&
    trimmed.length <= STAFF_PIN_MAX_LENGTH
  );
}
