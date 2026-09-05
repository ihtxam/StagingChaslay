const STORAGE_KEY = 'manupos_show_pos_toasts';
export const POS_TOAST_PREF_EVENT = 'pos-toasts:changed';

export function readShowPosToasts(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeShowPosToasts(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POS_TOAST_PREF_EVENT, { detail: enabled }));
  }
}
