/**
 * Platform detection and download URLs for Print Agent (Windows) vs Print Bridge (Android).
 */

const PRINT_AGENT_SETUP_FILE = 'reborn-print-agent-setup.exe';
const LEGACY_PRINT_AGENT_SETUP_FILE = 'chaslayreborn-print-agent-setup.exe';
const PRINT_BRIDGE_MANIFEST = 'reborn-print-bridge.json';

export type DownloadManifest = {
  success?: boolean;
  available: boolean;
  downloadUrl: string | null;
  message?: string;
  version?: string | null;
  sizeBytes?: number;
};

function apiOrigin(): string {
  return (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isWindowsDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /windows/i.test(navigator.userAgent);
}

export function printBridgeDownloadUrl(): string {
  const api = apiOrigin();
  if (!api || api.startsWith('/')) {
    return '/downloads/reborn-print-bridge.apk';
  }
  return `${api}/downloads/reborn-print-bridge.apk`;
}

export function printAgentDownloadUrl(): string {
  const api = apiOrigin();
  if (!api || api.startsWith('/')) {
    return `/downloads/${PRINT_AGENT_SETUP_FILE}`;
  }
  return `${api}/downloads/${PRINT_AGENT_SETUP_FILE}`;
}

export function legacyPrintAgentDownloadUrl(): string {
  const api = apiOrigin();
  if (!api || api.startsWith('/')) {
    return `/downloads/${LEGACY_PRINT_AGENT_SETUP_FILE}`;
  }
  return `${api}/downloads/${LEGACY_PRINT_AGENT_SETUP_FILE}`;
}

export function printBridgeManifestUrl(): string {
  const api = apiOrigin();
  if (!api || api.startsWith('/')) {
    return `/downloads/${PRINT_BRIDGE_MANIFEST}`;
  }
  return `${api}/downloads/${PRINT_BRIDGE_MANIFEST}`;
}

export async function fetchPrintBridgeManifest(): Promise<DownloadManifest> {
  try {
    const res = await fetch(printBridgeManifestUrl());
    if (!res.ok) {
      return {
        available: false,
        downloadUrl: null,
        message: 'Print Bridge download is not available on this server yet.',
      };
    }
    const data = (await res.json()) as DownloadManifest;
    return {
      available: !!data.available,
      downloadUrl: data.downloadUrl || null,
      message: data.message,
      version: data.version ?? null,
      sizeBytes: data.sizeBytes,
    };
  } catch {
    return {
      available: false,
      downloadUrl: null,
      message: 'Could not reach the download server. Check your connection and try again.',
    };
  }
}

/** Which local print companion this device should install. */
export function preferredPrintCompanion(): 'android-bridge' | 'windows-agent' | 'either' {
  if (isAndroidDevice()) return 'android-bridge';
  if (isWindowsDevice()) return 'windows-agent';
  return 'either';
}
