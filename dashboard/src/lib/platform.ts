/**
 * Runtime platform for WebPOS.
 * Keep Tauri-specific checks here — do not scatter `invoke` across the till UI.
 */

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri);
}

export function isBrowserPos(): boolean {
  return !isDesktopApp();
}

type TauriInternals = {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (typeof internals?.invoke !== 'function') {
    throw new Error('Not running inside Chaslay POS');
  }
  return internals.invoke(cmd, args) as Promise<T>;
}

export async function desktopPosEnv(): Promise<{ shell: string; version: string; debug: boolean } | null> {
  if (!isDesktopApp()) return null;
  try {
    return await invoke('pos_env');
  } catch {
    return { shell: 'tauri', version: 'unknown', debug: false };
  }
}

export async function setDesktopStartWithWindows(enabled: boolean): Promise<boolean> {
  return invoke('set_start_with_windows', { enabled });
}

export async function isDesktopStartWithWindows(): Promise<boolean> {
  return invoke('is_start_with_windows');
}

export type DesktopWindowMode = 'fullscreen' | 'maximized' | 'normal';

export async function desktopReload(): Promise<void> {
  if (!isDesktopApp()) {
    window.location.reload();
    return;
  }
  await invoke('desktop_reload');
}

export async function desktopWindowMode(): Promise<DesktopWindowMode> {
  if (!isDesktopApp()) return 'normal';
  const mode = await invoke<string>('desktop_window_mode');
  if (mode === 'fullscreen' || mode === 'maximized' || mode === 'normal') return mode;
  return 'normal';
}

export async function desktopToggleWindowMode(): Promise<DesktopWindowMode> {
  if (!isDesktopApp()) {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return 'normal';
    }
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
    return document.fullscreenElement ? 'fullscreen' : 'normal';
  }
  const mode = await invoke<string>('desktop_toggle_window_mode');
  if (mode === 'fullscreen' || mode === 'maximized' || mode === 'normal') return mode;
  return 'normal';
}

export async function desktopSidecarHealth(): Promise<{
  ok: boolean;
  version?: string;
  port?: number;
}> {
  if (!isDesktopApp()) return { ok: false };
  try {
    return (await invoke('sidecar_health')) as { ok: boolean; version?: string; port?: number };
  } catch {
    return { ok: false };
  }
}
