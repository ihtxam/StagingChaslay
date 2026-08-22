const recentBellKeys = new Set<string>();

/** True when this browser is the main register (not a waiter phone). */
export function isMainTillRegister(agentOnline: boolean): boolean {
  if (agentOnline) return true;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Mobile|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua)) return false;
  return !!window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
}

const DEDUPE_MS = 15000;
const DEDUPE_KEY = 'waiter-till-bell';

/** Dedupe bell/toast for remote waiter orders within 15s (held poll + print drain). */
export function shouldRingWaiterTillBell(_key: string): boolean {
  if (recentBellKeys.has(DEDUPE_KEY)) return false;
  recentBellKeys.add(DEDUPE_KEY);
  window.setTimeout(() => recentBellKeys.delete(DEDUPE_KEY), DEDUPE_MS);
  return true;
}
