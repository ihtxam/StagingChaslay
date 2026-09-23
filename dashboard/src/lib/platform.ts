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
    throw new Error('Not running inside RebornPOS');
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
  /** Native minimize to taskbar via Tauri command. */
  nativeMinimize: boolean;
  shellVersion: string | null;
};

let cachedChromeCapabilities: DesktopChromeCapabilities | null | undefined;

/** Probe whether the installed desktop shell exposes chrome commands. */
export async function probeDesktopChromeCapabilities(): Promise<DesktopChromeCapabilities> {
  if (!isDesktopApp()) {
    return { nativeReload: false, nativeMinimize: false, shellVersion: null };
  }
  if (cachedChromeCapabilities) return cachedChromeCapabilities;

  let shellVersion: string | null = null;
  let nativeMinimize = false;
  try {
    const env = await invoke<{ version?: string; chromeMinimize?: boolean }>('pos_env');
    shellVersion = typeof env?.version === 'string' ? env.version : null;
    nativeMinimize = env?.chromeMinimize === true;
  } catch {
    /* old or restricted shell */
  }

  let nativeReload = nativeMinimize;
  if (!nativeReload) {
    try {
      const mode = await invoke<string>('desktop_window_mode');
      nativeReload =
        mode === 'fullscreen' || mode === 'maximized' || mode === 'normal';
    } catch {
      nativeReload = false;
    }
  }

  const caps: DesktopChromeCapabilities = {
    nativeReload,
    nativeMinimize,
    shellVersion,
  };
  cachedChromeCapabilities = caps;
  return caps;
}

export type DesktopUpdateInfo = {
  available: boolean;
  version?: string | null;
  currentVersion: string;
  notes?: string | null;
};

export type DesktopUpdateProgress = {
  phase: 'downloading' | 'ready';
  downloaded: number;
  contentLength?: number | null;
};

export async function checkDesktopUpdate(): Promise<DesktopUpdateInfo> {
  if (!isDesktopApp()) {
    return { available: false, currentVersion: '0.0.0', version: null, notes: null };
  }
  return invoke<DesktopUpdateInfo>('desktop_check_update');
}

export async function downloadDesktopUpdate(): Promise<DesktopUpdateProgress> {
  return invoke<DesktopUpdateProgress>('desktop_download_update');
}

export async function applyDesktopUpdate(): Promise<void> {
  await invoke('desktop_apply_update');
}

export async function desktopUpdateProgress(): Promise<DesktopUpdateProgress> {
  return invoke<DesktopUpdateProgress>('desktop_update_progress');
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

export async function desktopMinimize(): Promise<void> {
  if (!isDesktopApp()) return;
  await invoke('desktop_minimize');
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

/** Start bundled Print Agent on 127.0.0.1:9101 when native printing is unavailable. */
export async function ensureDesktopPrintAgentSidecar(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  try {
    const health = (await invoke('ensure_print_agent_sidecar')) as { ok?: boolean };
    return health?.ok === true;
  } catch {
    return false;
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

let desktopReadySent = false;

/** Tell the native shell that hosted WebPOS finished booting (closes splash). */
export async function notifyDesktopAppReady(): Promise<void> {
  if (!isDesktopApp() || desktopReadySent) return;
  desktopReadySent = true;
  try {
    await invoke('desktop_app_ready');
  } catch (err) {
    if (!isMissingDesktopCommandError(err)) {
      console.warn('[desktop] desktop_app_ready failed:', formatDesktopInvokeError(err));
    }
  }
}
