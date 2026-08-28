/**
 * Platform detection and download URLs for Print Agent (Windows) vs Print Bridge (Android).
 */

import { compareAgentVersion } from '@/lib/print-agent';

const PRINT_AGENT_SETUP_FILE = 'reborn-print-agent-setup.exe';
const LEGACY_PRINT_AGENT_SETUP_FILE = 'chaslayreborn-print-agent-setup.exe';
const PRINT_AGENT_MANIFEST = 'reborn-print-agent.json';
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

export function printAgentManifestUrl(): string {
  const api = apiOrigin();
  if (!api || api.startsWith('/')) {
    return `/downloads/${PRINT_AGENT_MANIFEST}`;
  }
  return `${api}/downloads/${PRINT_AGENT_MANIFEST}`;
}

async function fetchDownloadManifest(
  url: string,
  unavailableMessage: string
): Promise<DownloadManifest> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        available: false,
        downloadUrl: null,
        message: unavailableMessage,
      };
    }
    const data = (await res.json()) as DownloadManifest;
    return {
      available: data.available !== false,
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

export async function fetchPrintBridgeManifest(): Promise<DownloadManifest> {
  return fetchDownloadManifest(
    printBridgeManifestUrl(),
    'Print Bridge download is not available on this server yet.'
  );
}

export async function fetchPrintAgentManifest(): Promise<DownloadManifest> {
  return fetchDownloadManifest(
    printAgentManifestUrl(),
    'Print Agent download is not available on this server yet.'
  );
}

export type PrintCompanionKind = 'windows-agent' | 'android-bridge';

export type PrintCompanionInstallStatus =
  | { state: 'not_installed' }
  | { state: 'update_available'; installed: string; latest: string }
  | { state: 'up_to_date'; installed: string };

/** Print Bridge uses 0.x semver; Print Agent uses 1.x+. */
export function isBridgeVersion(version: string): boolean {
  return /^0\./.test(String(version || '').trim());
}

export function resolvePrintCompanionInstallStatus(
  kind: PrintCompanionKind,
  installedVersion: string | null | undefined,
  serverVersion: string | null | undefined
): PrintCompanionInstallStatus {
  const installed = String(installedVersion || '').trim();
  if (!installed) return { state: 'not_installed' };

  const isBridge = isBridgeVersion(installed);
  if (kind === 'windows-agent' && isBridge) return { state: 'not_installed' };
  if (kind === 'android-bridge' && !isBridge) return { state: 'not_installed' };

  const latest = String(serverVersion || '').trim();
  if (!latest) return { state: 'up_to_date', installed };

  if (compareAgentVersion(installed, latest) < 0) {
    return { state: 'update_available', installed, latest };
  }
  return { state: 'up_to_date', installed };
}

/** Which local print companion this device should install. */
export function preferredPrintCompanion(): 'android-bridge' | 'windows-agent' | 'either' {
  if (isAndroidDevice()) return 'android-bridge';
  if (isWindowsDevice()) return 'windows-agent';
  return 'either';
}
