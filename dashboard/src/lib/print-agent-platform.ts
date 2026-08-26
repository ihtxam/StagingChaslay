/**
 * Platform detection for Print Agent (Windows) vs Print Bridge (Android).
 */

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isWindowsDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /windows/i.test(navigator.userAgent);
}

export function printBridgeDownloadUrl(): string {
  const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
  if (!api || api.startsWith('/')) {
    return '/downloads/reborn-print-bridge.apk';
  }
  return `${api}/downloads/reborn-print-bridge.apk`;
}

export function printAgentDownloadUrl(): string {
  const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
  if (!api || api.startsWith('/')) {
    return '/downloads/chaslay-print-agent-setup.exe';
  }
  return `${api}/downloads/chaslay-print-agent-setup.exe`;
}

/** Which local print companion this device should install. */
export function preferredPrintCompanion(): 'android-bridge' | 'windows-agent' | 'either' {
  if (isAndroidDevice()) return 'android-bridge';
  if (isWindowsDevice()) return 'windows-agent';
  return 'either';
}
