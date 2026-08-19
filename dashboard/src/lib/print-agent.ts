/**
 * ChaslayReborn Windows Print Agent (localhost).
 * Electron desktop also exposes window.manuposDesktop (legacy API name).
 */

export const PRINT_AGENT_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PRINT_AGENT_URL) ||
  'http://127.0.0.1:9101';

export type AgentPrinter = {
  name: string;
  isDefault?: boolean;
  status?: string;
  unsuitableForRaw?: boolean;
};

declare global {
  interface Window {
    manuposDesktop?: {
      listPrinters: () => Promise<AgentPrinter[]>;
      printEscPos: (payload: {
        printerName?: string;
        dataBase64: string;
        text?: string;
      }) => Promise<{ ok: boolean; error?: string; printer?: string }>;
      getAgentStatus: () => Promise<{ running: boolean; port: number }>;
    };
  }
}

/** Virtual / GDI drivers that cannot usefully accept ESC/POS RAW bytes. */
export function isUnsuitableRawPrinter(name?: string | null): boolean {
  const n = String(name || '').toLowerCase();
  if (!n.trim()) return false;
  return /onenote|microsoft print to pdf|microsoft xps|send to onenote|\bfax\b|adobe pdf|foxit|nitro pdf|cutepdf|pdfcreator|dopdf|bullzip|print to pdf|microsoft shared fax/.test(
    n
  );
}

export function unsuitableRawPrinterMessage(name?: string | null): string {
  const label = (name || '').trim() || 'this printer';
  return `Select a receipt/ESC-POS printer, not OneNote/PDF (${label}). Raw bytes will not print usefully.`;
}

/** True if the name already looks mangled (accents → '?'). */
export function looksCorruptedPrinterName(name?: string | null): boolean {
  return !!name && name.includes('?');
}

/** Collapse PowerShell / Win32 dumps into a one-line ChaslayReborn message. */
export function friendlyPrintAgentError(raw: unknown): string {
  const msg = String(raw || '').trim();
  if (!msg) return 'Print failed';
  const open = msg.match(/OpenPrinter failed for '([^']+)' \(Win32=(\d+)\)/i);
  const named = msg.match(/Printer '([^']+)' not found/i);
  const name = (open?.[1] || named?.[1] || '').trim();
  const code = open ? Number(open[2]) : Number((msg.match(/Win32=(\d+)/i) || [])[1] || 0);
  if (code === 1801 || /not found or disconnected|ERROR_INVALID_PRINTER_NAME/i.test(msg)) {
    return name ? `Printer '${name}' not found or disconnected` : 'Printer not found or disconnected';
  }
  if (/win-raw-print|CategoryInfo|FullyQualifiedErrorId|chaslayreborn-print-|manupos-print-/i.test(msg)) {
    return name ? `Printer '${name}' not found or disconnected` : 'Print failed';
  }
  return msg.length > 220 ? `${msg.slice(0, 217)}…` : msg;
}

async function agentFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${PRINT_AGENT_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(friendlyPrintAgentError(err.error || `Print agent HTTP ${res.status}`));
  }
  return res.json();
}

export async function isPrintAgentAvailable(): Promise<boolean> {
  if (window.manuposDesktop) {
    try {
      const s = await window.manuposDesktop.getAgentStatus();
      return !!s.running;
    } catch {
      return true; // desktop bridge present
    }
  }
  try {
    const data = await agentFetch('/health');
    return !!data.ok;
  } catch {
    return false;
  }
}

export async function listAgentPrinters(): Promise<AgentPrinter[]> {
  if (window.manuposDesktop?.listPrinters) {
    const list = await window.manuposDesktop.listPrinters();
    return (list || []).map((p) => ({
      ...p,
      unsuitableForRaw: p.unsuitableForRaw ?? isUnsuitableRawPrinter(p.name),
    }));
  }
  const data = await agentFetch('/printers');
  return (data.printers || []).map((p: AgentPrinter) => ({
    ...p,
    unsuitableForRaw: p.unsuitableForRaw ?? isUnsuitableRawPrinter(p.name),
  }));
}

export type PrintViaAgentResult = {
  ok: true;
  printer?: string;
};

export async function printViaAgent(opts: {
  printerName?: string;
  dataBase64: string;
  text?: string;
}): Promise<PrintViaAgentResult> {
  const name = opts.printerName?.trim() || '';
  if (name && isUnsuitableRawPrinter(name)) {
    throw new Error(unsuitableRawPrinterMessage(name));
  }
  if (looksCorruptedPrinterName(name)) {
    throw new Error(
      `Printer name looks corrupted ('${name}'). Re-select the printer in ChaslayReborn after updating the Print Agent.`
    );
  }

  if (window.manuposDesktop?.printEscPos) {
    const res = await window.manuposDesktop.printEscPos(opts);
    if (!res.ok) throw new Error(friendlyPrintAgentError(res.error || 'Desktop print failed'));
    if (res.printer && isUnsuitableRawPrinter(res.printer)) {
      throw new Error(unsuitableRawPrinterMessage(res.printer));
    }
    return { ok: true, printer: res.printer };
  }
  const data = await agentFetch('/print', {
    method: 'POST',
    body: JSON.stringify({
      printerName: opts.printerName || undefined,
      dataBase64: opts.dataBase64,
      text: opts.text,
    }),
  });
  if (data?.printer && isUnsuitableRawPrinter(data.printer)) {
    throw new Error(unsuitableRawPrinterMessage(data.printer));
  }
  return { ok: true, printer: data?.printer };
}

/** ESC/POS initialize + cash drawer kick (pin 2): 1B 40 1B 70 00 19 FA */
const DRAWER_KICK_BASE64 = 'G0AbcAAZ+g==';

/**
 * Open cash drawer via print agent.
 * Prefers POST /drawer; falls back to POST /print with kick bytes for older agents.
 */
export async function openCashDrawerViaAgent(opts?: { printerName?: string }): Promise<void> {
  const printerName = opts?.printerName || undefined;
  if (printerName && isUnsuitableRawPrinter(printerName)) {
    throw new Error(unsuitableRawPrinterMessage(printerName));
  }
  try {
    await agentFetch('/drawer', {
      method: 'POST',
      body: JSON.stringify({ printerName }),
    });
    return;
  } catch (e: any) {
    const msg = String(e?.message || '');
    // Older print-agent builds have /print but not /drawer.
    if (!/HTTP 404|Cannot POST \/drawer|Not Found/i.test(msg)) {
      throw e;
    }
  }
  await printViaAgent({
    printerName,
    dataBase64: DRAWER_KICK_BASE64,
  });
}

export type ScaleReading = {
  weightKg: number;
  rawWeight?: string;
  units?: string;
  status?: string;
  isZero?: boolean;
  isTare?: boolean;
};

/** Normalize COM port for Windows serial open (COM10+ needs \\.\ prefix). */
export function normalizeScalePort(port: string): string {
  const raw = String(port || '').trim();
  if (!raw) return '';
  const stripped = raw.replace(/^\\\\\.\\/i, '').toUpperCase();
  const m = stripped.match(/^COM(\d+)$/);
  if (!m) return raw;
  const num = parseInt(m[1], 10);
  const com = `COM${num}`;
  return num >= 10 ? `\\\\.\\${com}` : com;
}

/** User-facing COM label (always COMn, no \\.\ prefix). */
export function formatScalePortLabel(port: string): string {
  const raw = String(port || '').trim();
  if (!raw) return '';
  const stripped = raw.replace(/^\\\\\.\\/i, '').toUpperCase();
  const m = stripped.match(/^COM(\d+)$/);
  return m ? `COM${parseInt(m[1], 10)}` : raw;
}

/** Windows COM ports from Print Agent (Aclas USB-serial → COMx). */
export async function listScalePorts(): Promise<string[]> {
  try {
    const data = await agentFetch('/scale/ports');
    return Array.isArray(data?.ports) ? data.ports.map(String) : [];
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/HTTP 404|Cannot GET \/scale\/ports/i.test(msg)) {
      throw new Error(
        'Print Agent is outdated — reinstall Chaslay Print Agent to enable scale support.'
      );
    }
    throw e;
  }
}

/** One Aclas reading from Print Agent (null if no frame yet). */
export async function readScaleWeight(
  port: string,
  timeoutMs = 2500
): Promise<{ reading: ScaleReading | null; message?: string }> {
  const normalized = normalizeScalePort(port);
  if (!normalized) {
    throw new Error('COM port required (e.g. COM3)');
  }
  const q = new URLSearchParams({
    port: normalized,
    timeoutMs: String(timeoutMs),
  });
  const data = await agentFetch(`/scale/reading?${q.toString()}`);
  return {
    reading: (data?.reading as ScaleReading | null) || null,
    message: data?.message ? String(data.message) : undefined,
  };
}

export function browserPrintText(text: string, qrImageSrc?: string) {
  const w = window.open('', '_blank', 'width=400,height=700');
  if (!w) throw new Error('Popup blocked - allow popups to print');
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const qrHtml = qrImageSrc
    ? `<div style="text-align:center;margin-top:8px"><img src="${qrImageSrc}" width="160" height="160" alt="QR receipt"/><div style="font:11px monospace;margin-top:4px">Scan for digital receipt</div></div>`
    : '';
  w.document.write(
    `<!DOCTYPE html><html><head><title>Print</title><meta charset="utf-8"/></head><body>` +
      `<pre style="font:12px/1.3 monospace;white-space:pre-wrap;padding:12px;margin:0">${safe}</pre>${qrHtml}` +
      `</body></html>`
  );
  w.document.close();
  w.focus();
  // Give QR image a moment to load before print dialog
  setTimeout(() => w.print(), qrImageSrc ? 400 : 50);
}
