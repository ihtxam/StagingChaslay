/** Staff POS PIN length (WebPOS, panel gate, Android POS, kiosk admin). */
export const STAFF_PIN_LENGTH = 4;

export const STAFF_PIN_VALIDATION_ERROR = "PIN must be exactly 4 digits";

export function normalizeStaffPinInput(pin: unknown): string {
  return String(pin ?? "")
    .trim()
    .replace(/\D/g, "");
}

export function isValidStaffPin(pin: unknown): boolean {
  const normalized = normalizeStaffPinInput(pin);
  return normalized.length === STAFF_PIN_LENGTH && /^\d+$/.test(normalized);
}

export function assertValidStaffPin(pin: unknown): string {
  const normalized = normalizeStaffPinInput(pin);
  if (!isValidStaffPin(normalized)) {
    throw new Error(STAFF_PIN_VALIDATION_ERROR);
  }
  return normalized;
}
