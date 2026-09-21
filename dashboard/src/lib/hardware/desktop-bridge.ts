/**
 * Phase D: Tauri hardware bridge — native Win32 + serial COM first, Print Agent sidecar fallback only when needed.
 * Keeps print-agent.ts contract via window.manuposDesktop.
 */

import type { AgentPrinter, ScaleDevice, ScaleReading } from '@/lib/print-agent';
import { isDesktopApp } from '@/lib/platform';

type TauriInternals = {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

/** Same contract as `@tauri-apps/api/core` invoke — uses Tauri internals in hosted WebPOS. */
export async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (typeof internals?.invoke !== 'function') {
    throw new Error('Not running inside RebornPOS');
  }
  return internals.invoke(cmd, args) as Promise<T>;
}

export type DesktopHwCapabilities = {
  nativePrint: boolean;
  nativeSerial?: boolean;
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
    return (await tauriInvoke('hw_capabilities')) as DesktopHwCapabilities;
  } catch {
    return null;
  }
}

export async function getAvailablePrinters(): Promise<string[]> {
  const data = (await tauriInvoke('get_available_printers')) as { ports?: string[] };
  return Array.isArray(data?.ports) ? data.ports : [];
}

export async function printToThermalDevice(opts: {
  portName: string;
  baudRate?: number;
  payload: string;
}): Promise<{ ok: boolean; port?: string; source?: string }> {
  return (await tauriInvoke('print_to_thermal_device', {
    portName: opts.portName,
    baudRate: opts.baudRate ?? 9600,
    payload: opts.payload,
  })) as { ok: boolean; port?: string; source?: string };
}

export async function installDesktopHardwareBridge(): Promise<void> {
  if (!isDesktopApp() || typeof window === 'undefined') return;
  if (window.manuposDesktop) return;

  window.manuposDesktop = {
    async listPrinters(): Promise<AgentPrinter[]> {
      const data = (await tauriInvoke('hw_list_printers')) as { printers?: AgentPrinter[] };
      return Array.isArray(data?.printers) ? data.printers : [];
    },
    async printEscPos(payload: {
      printerName?: string;
      dataBase64: string;
      text?: string;
      portName?: string;
      baudRate?: number;
    }): Promise<{ ok: boolean; error?: string; printer?: string }> {
      const result = (await tauriInvoke('hw_print', { payload })) as {
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
      const data = (await tauriInvoke('hw_agent_status')) as {
        running?: boolean;
        port?: number;
        source?: string;
      };
      return {
        running: data?.running === true,
        port: Number(data?.port) || 0,
      };
    },
  };
}

export async function desktopListPrinters(): Promise<AgentPrinter[]> {
  const data = (await tauriInvoke('hw_list_printers')) as { printers?: AgentPrinter[] };
  return Array.isArray(data?.printers) ? data.printers : [];
}

export async function desktopPrintEscPos(payload: {
  printerName?: string;
  dataBase64: string;
  text?: string;
  portName?: string;
  baudRate?: number;
}): Promise<{ ok: boolean; error?: string; printer?: string; source?: string }> {
  return (await tauriInvoke('hw_print', { payload })) as {
    ok: boolean;
    error?: string;
    printer?: string;
    source?: string;
  };
}

export async function desktopDrawerKick(printerName?: string): Promise<{ ok: boolean; source?: string }> {
  return (await tauriInvoke('hw_drawer', { printerName: printerName || null })) as {
    ok: boolean;
    source?: string;
  };
}

export async function desktopScalePorts(): Promise<{ ports: string[]; devices: ScaleDevice[] }> {
  const data = (await tauriInvoke('hw_scale_ports')) as {
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
  const data = (await tauriInvoke('hw_scale_reading', { port, timeoutMs })) as {
    reading?: ScaleReading | null;
    message?: string;
  };
  return {
    reading: data?.reading ?? null,
    message: data?.message,
  };
}
