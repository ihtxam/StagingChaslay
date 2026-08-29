const UNLOCK_KEY = 'reborn-kiosk-admin-unlock';
const PIN_KEY = 'reborn-kiosk-admin-pin';

export function isKioskAdminUnlocked(token: string): boolean {
  try {
    return sessionStorage.getItem(`${UNLOCK_KEY}:${token}`) === '1';
  } catch {
    return false;
  }
}

export function setKioskAdminUnlocked(token: string, pin: string) {
  sessionStorage.setItem(`${UNLOCK_KEY}:${token}`, '1');
  sessionStorage.setItem(`${PIN_KEY}:${token}`, pin);
}

export function getKioskAdminPin(token: string): string {
  try {
    return sessionStorage.getItem(`${PIN_KEY}:${token}`) || '';
  } catch {
    return '';
  }
}

export function clearKioskAdminUnlock(token: string) {
  sessionStorage.removeItem(`${UNLOCK_KEY}:${token}`);
  sessionStorage.removeItem(`${PIN_KEY}:${token}`);
}
