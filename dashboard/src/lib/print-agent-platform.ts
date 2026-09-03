/**
 * Platform detection and download URLs for Print Agent (Windows) vs Bridge Reborn (Android).
 */

import { resolveApiOriginForBridge } from '@/lib/api';
import { compareAgentVersion, isBridgeVersion } from '@/lib/print-agent';

const PRINT_AGENT_SETUP_FILE = 'reborn-print-agent-setup.exe';
const PRINT_AGENT_MANIFEST = 'reborn-print-agent.json';
const PRINT_BRIDGE_MANIFEST = 'reborn-print-bridge.json';

export type DownloadManifest = {
  success?: boolean;
  available: boolean;
  downloadUrl: string | null;
  message?: string;
  version?: string | null;
  declaredVersion?: string | null;
  versionMismatch?: boolean;
  sizeBytes?: number;
};

function apiOrigin(): string {
  return resolveApiOriginForBridge();
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

/** Open Bridge APK install on Android (package installer) instead of saving duplicate files. */
export function openPrintBridgeApkInstall(url?: string): void {
  if (typeof window === 'undefined') return;
  window.location.assign(url || printBridgeDownloadUrl());
}

export function isBridgeAlreadyInstalled(
  agentOk: boolean,
  installedVersion: string | null | undefined
): boolean {
  if (!agentOk) return false;
  const v = String(installedVersion || '').trim();
  return !!v && isBridgeVersion(v);
}

export function printAgentDownloadUrl(): string {
  const api = apiOrigin();
  if (!api || api.startsWith('/')) {
    return `/downloads/${PRINT_AGENT_SETUP_FILE}`;
  }
  return `${api}/downloads/${PRINT_AGENT_SETUP_FILE}`;
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
      declaredVersion: data.declaredVersion ?? null,
      versionMismatch: data.versionMismatch === true,
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
    'Bridge Reborn download is not available on this server yet.'
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
  | { state: 'checking' }
  | { state: 'not_installed' }
  | { state: 'not_responding' }
  | { state: 'update_available'; installed: string; latest: string }
  | { state: 'up_to_date'; installed: string };

export function resolvePrintCompanionInstallStatus(
  kind: PrintCompanionKind,
  installedVersion: string | null | undefined,
  serverVersion: string | null | undefined,
  options?: { onAndroid?: boolean; agentChecked?: boolean; agentOk?: boolean }
): PrintCompanionInstallStatus {
  const installed = String(installedVersion || '').trim();
  if (!installed) {
    if (!options?.agentChecked) return { state: 'checking' };
    if (options.agentOk) return { state: 'up_to_date', installed: '?' };
    if (kind === 'android-bridge' && options.onAndroid) return { state: 'not_responding' };
    if (kind === 'windows-agent') return { state: 'not_responding' };
    return { state: 'not_installed' };
  }

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
