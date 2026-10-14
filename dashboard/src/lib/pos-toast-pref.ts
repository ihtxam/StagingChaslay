const STORAGE_KEY = 'manupos_show_pos_toasts';
export const POS_TOAST_PREF_EVENT = 'pos-toasts:changed';

export function readShowPosToasts(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Success/info stay quiet when the POS pref is off; payment errors still show. */
export function shouldShowPosToast(opts: {
  showPosToasts: boolean;
  toastType?: string | null;
}): boolean {
  if (opts.showPosToasts) return true;
  return opts.toastType === 'error';
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
