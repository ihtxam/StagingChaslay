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

export function formatDesktopInvokeError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: string }).message;
    if (message) return message;
  }
  return String(err ?? 'Unknown desktop bridge error');
}

export function isMissingDesktopCommandError(err: unknown): boolean {
  const msg = formatDesktopInvokeError(err).toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('unknown command') ||
    msg.includes('command') && msg.includes('not allowed')
  );
}

export type DesktopChromeCapabilities = {
  /** Native reload via Tauri command (vs page reload fallback). */
  nativeReload: boolean;
  /** Native window maximize/restore via Tauri command. */
  nativeWindowMode: boolean;
  shellVersion: string | null;
};

let cachedChromeCapabilities: DesktopChromeCapabilities | null | undefined;

/** Probe whether the installed desktop shell exposes chrome commands. */
export async function probeDesktopChromeCapabilities(): Promise<DesktopChromeCapabilities> {
  if (!isDesktopApp()) {
    return { nativeReload: false, nativeWindowMode: false, shellVersion: null };
  }
  if (cachedChromeCapabilities) return cachedChromeCapabilities;

  let shellVersion: string | null = null;
  try {
    const env = await invoke<{ version?: string }>('pos_env');
    shellVersion = typeof env?.version === 'string' ? env.version : null;
  } catch {
    /* old or restricted shell */
  }

  let nativeWindowMode = false;
  try {
    const mode = await invoke<string>('desktop_window_mode');
    nativeWindowMode =
      mode === 'fullscreen' || mode === 'maximized' || mode === 'normal';
  } catch {
    nativeWindowMode = false;
  }

  const caps: DesktopChromeCapabilities = {
    nativeReload: nativeWindowMode,
    nativeWindowMode,
    shellVersion,
  };
  cachedChromeCapabilities = caps;
  return caps;
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

export async function desktopReload(): Promise<'native' | 'fallback'> {
  if (!isDesktopApp()) {
    window.location.reload();
    return 'fallback';
  }
  try {
    await invoke('desktop_reload');
    return 'native';
  } catch (err) {
    if (!isMissingDesktopCommandError(err)) throw err;
    window.location.reload();
    return 'fallback';
  }
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
  bundled?: boolean;
}> {
  if (!isDesktopApp()) return { ok: false };
  try {
    return (await invoke('sidecar_health')) as {
      ok: boolean;
      version?: string;
      port?: number;
      bundled?: boolean;
    };
  } catch {
    return { ok: false };
  }
}

/** True when Tauri shell is present and desktop chrome commands respond. */
export async function desktopChromeAvailable(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  try {
    await invoke('desktop_window_mode');
    return true;
  } catch {
    return false;
  }
}
