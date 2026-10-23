/** Till print-hub eligibility without importing webpos-print-relay / print-agent (Dashboard init TDZ). */

function isKioskPrintContext(): boolean {
  if (typeof window === 'undefined') return false;
  return /^\/kiosk\/[^/]+/.test(window.location.pathname);
}

function isAndroidTabletDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (!/android/i.test(ua)) return false;
  if (/tablet|pad|sm-t|lenovo tab|galaxy tab/i.test(ua)) return true;
  if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 600px)').matches) return true;
  return false;
}

function isAndroidWebPosTill(): boolean {
  if (typeof navigator === 'undefined' || !/android/i.test(navigator.userAgent || '')) {
    return false;
  }
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  if (nav.standalone === true) return true;
  return false;
}

export function isTillPrintHubCandidate(): boolean {
  if (isKioskPrintContext()) return false;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  if (isAndroidWebPosTill()) return true;
  if (isAndroidTabletDevice()) return true;
  const ua = navigator.userAgent || '';
  if (/Mobile|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua)) return false;
  return true;
}
