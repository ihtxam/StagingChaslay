/**
 * Phase D: Tauri hardware bridge — delegates to Print Agent sidecar (127.0.0.1:9101)
 * via Rust commands. Keeps print-agent.ts contract via window.manuposDesktop.
 */

import type { AgentPrinter } from '@/lib/print-agent';
import { isDesktopApp } from '@/lib/platform';

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
      return (await invoke('hw_print', { payload })) as {
        ok: boolean;
        error?: string;
        printer?: string;
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
