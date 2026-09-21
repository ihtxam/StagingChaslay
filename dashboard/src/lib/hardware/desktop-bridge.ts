/**
 * Phase D: Tauri hardware bridge — native Win32 first, Print Agent sidecar fallback.
 * Keeps print-agent.ts contract via window.manuposDesktop.
 */

import type { AgentPrinter, ScaleDevice, ScaleReading } from '@/lib/print-agent';
import { isDesktopApp } from '@/lib/platform';

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

export type DesktopHwCapabilities = {
  nativePrint: boolean;
  sidecarBundled: boolean;
  paths: {
    printers: string;
    print: string;
    drawer: string;
  };
};

export async function desktopHwCapabilities(): Promise<DesktopHwCapabilities | null> {
  if (!isDesktopApp()) return null;
  try {
    return (await invoke('hw_capabilities')) as DesktopHwCapabilities;
  } catch {
    return null;
  }
}

export async function installDesktopHardwareBridge(): Promise<void> {
  if (!isDesktopApp() || typeof window === 'undefined') return;
  if (window.manuposDesktop) return;

  window.manuposDesktop = {
    async listPrinters(): Promise<AgentPrinter[]> {
      const data = (await invoke('hw_list_printers')) as { printers?: AgentPrinter[] };
      return Array.isArray(data?.printers) ? data.printers : [];
    },
    async printEscPos(payload: {
      printerName?: string;
      dataBase64: string;
      text?: string;
    }): Promise<{ ok: boolean; error?: string; printer?: string }> {
      const result = (await invoke('hw_print', { payload })) as {
        ok?: boolean;
        error?: string;
        printer?: string;
      };
      return {
        ok: result?.ok !== false,
        error: result?.error,
        printer: result?.printer,
      };
    },
    async getAgentStatus(): Promise<{ running: boolean; port: number }> {
      const data = (await invoke('hw_agent_status')) as {
        running?: boolean;
        port?: number;
      };
      return {
        running: data?.running === true,
        port: Number(data?.port) || 9101,
      };
    },
  };
}

export async function desktopListPrinters(): Promise<AgentPrinter[]> {
  const data = (await invoke('hw_list_printers')) as { printers?: AgentPrinter[] };
  return Array.isArray(data?.printers) ? data.printers : [];
}

export async function desktopPrintEscPos(payload: {
  printerName?: string;
  dataBase64: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string; printer?: string; source?: string }> {
  return (await invoke('hw_print', { payload })) as {
    ok: boolean;
    error?: string;
    printer?: string;
    source?: string;
  };
}

export async function desktopDrawerKick(printerName?: string): Promise<{ ok: boolean; source?: string }> {
  return (await invoke('hw_drawer', { printerName: printerName || null })) as {
    ok: boolean;
    source?: string;
  };
}

export async function desktopScalePorts(): Promise<{ ports: string[]; devices: ScaleDevice[] }> {
  const data = (await invoke('hw_scale_ports')) as {
    ports?: string[];
    devices?: ScaleDevice[];
  };
  return {
    ports: Array.isArray(data?.ports) ? data.ports : [],
    devices: Array.isArray(data?.devices) ? data.devices : [],
  };
}

export async function desktopScaleReading(
  port: string,
  timeoutMs = 2500
): Promise<{ reading: ScaleReading | null; message?: string }> {
  const data = (await invoke('hw_scale_reading', { port, timeoutMs })) as {
    reading?: ScaleReading | null;
    message?: string;
  };
  return {
    reading: data?.reading ?? null,
    message: data?.message,
  };
}
