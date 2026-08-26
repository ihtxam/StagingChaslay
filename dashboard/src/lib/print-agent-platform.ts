/**
 * Platform detection and download URLs for Print Agent (Windows) vs Print Bridge (Android).
 */

const PRINT_AGENT_SETUP_FILE = 'chaslayreborn-print-agent-setup.exe';

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isWindowsDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /windows/i.test(navigator.userAgent);
}

export function printAgentDownloadUrl(): string {
  const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
  if (!api || api.startsWith('/')) {
    return `/downloads/${PRINT_AGENT_SETUP_FILE}`;
  }
  return `${api}/downloads/${PRINT_AGENT_SETUP_FILE}`;
}

/** Which local print companion this device should install. */
export function preferredPrintCompanion(): 'android-bridge' | 'windows-agent' | 'either' {
  if (isAndroidDevice()) return 'android-bridge';
  if (isWindowsDevice()) return 'windows-agent';
  return 'either';
}
