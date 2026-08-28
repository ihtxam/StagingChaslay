/**
 * Reborn Windows Print Agent (localhost).
 * Electron desktop also exposes window.manuposDesktop (legacy API name).
 */

export const PRINT_AGENT_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PRINT_AGENT_URL) ||
  'http://127.0.0.1:9101';

export type AgentPrinter = {
  name: string;
  portName?: string;
  driverName?: string;
  matchHint?: string;
  isDefault?: boolean;
  status?: string;
  unsuitableForRaw?: boolean;
};

export type ScaleDevice = {
  port: string;
  caption?: string;
  manufacturer?: string;
  pnpDeviceId?: string;
  name?: string;
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

export function normalizePrinterName(name?: string | null): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, '');
}

/** Strip COM numbers so "RPP02 (COM7)" still matches "RPP02 (COM12)". */
export function stableDeviceKey(name?: string | null): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\(com\d+\)/gi, '')
    .replace(/com\d+/gi, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function printerNameInList(
  name: string,
  printers: Array<{ name: string; matchHint?: string; portName?: string; driverName?: string }>
): boolean {
  const n = normalizePrinterName(name);
  if (!n) return false;
  if (printers.some((p) => normalizePrinterName(p.name) === n)) return true;
  const want = stableDeviceKey(name);
  if (!want) return false;
  return printers.some((p) => {
    const keys = [p.name, p.matchHint, p.driverName, p.portName].map(stableDeviceKey).filter(Boolean);
    return keys.some((k) => k === want || k.includes(want) || want.includes(k));
  });
}

function paperWidthHint(name: string): '58' | '80' | null {
  const n = String(name || '').toLowerCase();
  if (/\b58\b|58mm/.test(n)) return '58';
  if (/\b80\b|80mm|pos80|printer80/.test(n)) return '80';
  return null;
}

export function looksLikeThermal80mm(name?: string | null): boolean {
  const n = String(name || '');
  if (!n.trim() || isUnsuitableRawPrinter(n)) return false;
  return /\b80\b|80mm|pos80|printer80|thermal|receipt|escpos|xp-|rp80|tm-|chaslay/i.test(n);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (a === b) return 0;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function scorePrinterSimilarity(configured: string, candidate: string): number {
  const stableCfg = stableDeviceKey(configured);
  const stableCand = stableDeviceKey(candidate);
  if (stableCfg && stableCand && (stableCfg === stableCand || stableCand.includes(stableCfg) || stableCfg.includes(stableCand))) {
    return 12;
  }
  const cfg = normalizePrinterName(configured);
  const cand = normalizePrinterName(candidate);
  if (!cfg || !cand || cfg === cand) return 0;
  let score = 0;
  const cfgWidth = paperWidthHint(configured);
  const candWidth = paperWidthHint(candidate);
  if (cfgWidth && candWidth && cfgWidth === candWidth) score += 3;
  const cfgDigits = (cfg.match(/\d+$/) || [])[0];
  const candDigits = (cand.match(/\d+$/) || [])[0];
  if (cfgDigits && cfgDigits === candDigits) score += 4;
  if (looksLikeThermal80mm(candidate) && (cfgWidth === '80' || /80/.test(cfg))) score += 2;
  const dist = levenshtein(cfg, cand);
  if (dist <= 4) score += 5;
  else if (dist <= 8) score += 2;
  if (cand.includes(cfg) || cfg.includes(cand)) score += 3;
  return score;
}

function scoreDeviceMatch(configured: string, candidate: string): number {
  const cfg = stableDeviceKey(configured);
  const cand = stableDeviceKey(candidate);
  if (!cfg || !cand) return 0;
  if (cfg === cand) return 20;
  if (cand.includes(cfg) || cfg.includes(cand)) return 12;
  return 0;
}

/** Map a saved Windows name to the live queue name (exact, case, or device-key match). */
export function resolveAgentPrinterName(
  configuredName: string,
  printers: AgentPrinter[]
): string | null {
  const want = String(configuredName || '').trim();
  if (!want) return null;
  const exact = printers.find((p) => p.name === want);
  if (exact) return exact.name;
  const ci = printers.find((p) => p.name.toLowerCase() === want.toLowerCase());
  if (ci) return ci.name;
  const wantPort = want.toUpperCase().match(/^COM\d+$/)?.[0] || '';
  if (wantPort) {
    const byPort = printers.find((p) => String(p.portName || '').toUpperCase() === wantPort);
    if (byPort) return byPort.name;
  }
  const scored = printers
    .map((p) => ({
      p,
      score: Math.max(
        scoreDeviceMatch(want, p.name),
        scoreDeviceMatch(want, p.matchHint || ''),
        scoreDeviceMatch(want, p.driverName || ''),
        scoreDeviceMatch(want, p.portName || '')
      ),
    }))
    .filter((x) => x.score >= 12)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.p.name || null;
}

/** Dedupe agent enumeration by exact Windows queue name. */
export function normalizeAgentPrinterList(printers: AgentPrinter[]): AgentPrinter[] {
  const seen = new Set<string>();
  const out: AgentPrinter[] = [];
  for (const p of printers) {
    const name = String(p.name || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      ...p,
      name,
      unsuitableForRaw: p.unsuitableForRaw ?? isUnsuitableRawPrinter(name),
    });
  }
  return out;
}

export type PosPrinterProfileLike = {
  id?: string;
  name: string;
  portName?: string | null;
  matchHint?: string | null;
  enabled?: boolean;
};

/**
 * After a live /printers refresh: heal renamed queues, clear names that no longer exist.
 * Keeps profile rows so kitchen routing / category links are not lost.
 */
export function reconcilePosPrinterProfiles<T extends PosPrinterProfileLike>(
  profiles: T[],
  livePrinters: AgentPrinter[]
): { profiles: T[]; changed: boolean } {
  let changed = false;
  const next = profiles.map((p) => {
    const name = String(p.name || '').trim();
    if (!name) return p;
    const resolved = resolveAgentPrinterName(name, livePrinters);
    if (resolved) {
      if (resolved === name) return p;
      const picked = livePrinters.find((ap) => ap.name === resolved);
      changed = true;
      return {
        ...p,
        name: resolved,
        portName: picked?.portName ?? p.portName ?? null,
        matchHint: picked?.matchHint ?? picked?.driverName ?? p.matchHint ?? null,
      };
    }
    const heal = suggestPrinterAutoHeal(name, livePrinters);
    if (heal) {
      changed = true;
      return {
        ...p,
        name: heal.name,
        portName: heal.portName ?? p.portName ?? null,
        matchHint: heal.matchHint ?? heal.driverName ?? p.matchHint ?? null,
      };
    }
    changed = true;
    return { ...p, name: '' };
  });
  return { profiles: next, changed };
}

/** Agent is up but the stored Windows name is gone (rename / 1801). */
export function isConfiguredPrinterMissing(
  configuredName: string,
  printers: Array<{ name: string }>,
  opts?: { agentOk?: boolean; printersReady?: boolean }
): boolean {
  const name = String(configuredName || '').trim();
  if (!name) return false;
  if (opts?.agentOk === false) return false;
  if (opts?.printersReady === false) return false;
  return !resolveAgentPrinterName(name, printers as AgentPrinter[]);
}

/** Close matches for a missing name (e.g. GLPrinter80 → chaslay80). */
export function findSimilarAgentPrinters(
  configuredName: string,
  printers: AgentPrinter[]
): AgentPrinter[] {
  const configured = String(configuredName || '').trim();
  if (!configured) return [];
  const available = printers.filter((p) => p.name && !isUnsuitableRawPrinter(p.name));
  if (printerNameInList(configured, available)) return [];
  return available
    .map((p) => ({ p, score: scorePrinterSimilarity(configured, p.name) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

/** Prompt candidates: similar names, else any 80mm-looking printer. */
export function findPrinterHealCandidates(
  configuredName: string,
  printers: AgentPrinter[],
  limit = 3
): AgentPrinter[] {
  const similar = findSimilarAgentPrinters(configuredName, printers);
  if (similar.length) return similar.slice(0, limit);
  const suitable = printers.filter((p) => p.name && !isUnsuitableRawPrinter(p.name));
  const eighty = suitable.filter((p) => looksLikeThermal80mm(p.name));
  return (eighty.length ? eighty : suitable).slice(0, limit);
}

/** Auto-heal only when the old name is gone and exactly one similar name exists. */
export function suggestPrinterAutoHeal(
  configuredName: string,
  printers: AgentPrinter[]
): AgentPrinter | null {
  const similar = findSimilarAgentPrinters(configuredName, printers);
  return similar.length === 1 ? similar[0] : null;
}

export function unsuitableRawPrinterMessage(name?: string | null): string {
  const label = (name || '').trim() || 'this printer';
  return `Select a receipt/ESC-POS printer, not OneNote/PDF (${label}). Raw bytes will not print usefully.`;
}

/** True if the name already looks mangled (accents → '?'). */
export function looksCorruptedPrinterName(name?: string | null): boolean {
  return !!name && name.includes('?');
}

/** 1.7.0+ lists USB/Bluetooth devices by name so COM ports can change. */
export const MIN_PRINT_AGENT_VERSION = '1.7.0';

function asPrintText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Flatten Error / agent JSON / stderr so old manupos-print dumps are still detected. */
export function collectPrintErrorText(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (raw instanceof Error) {
    return [raw.message, (raw as Error & { stderr?: unknown }).stderr].filter(Boolean).join('\n').trim();
  }
  const obj = raw as {
    response?: { data?: { error?: unknown } };
    message?: unknown;
    error?: unknown;
    stderr?: unknown;
  };
  return [
    asPrintText(obj.response?.data?.error),
    asPrintText(obj.error),
    asPrintText(obj.message),
    asPrintText(obj.stderr),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function extractPrinterNameFromError(msg: string, fallback?: string): string {
  const m =
    msg.match(/OpenPrinter failed for '([^']+)'/i) ||
    msg.match(/Printer '([^']+)' not found/i) ||
    msg.match(/failed for '([^']+)'/i) ||
    msg.match(/GLPrinter\d*/i);
  return (m?.[1] || m?.[0] || fallback || '').trim();
}

/** Win32 printer spooler codes: invalid name, deleted queue, bad state. */
const WIN32_PRINTER_UNAVAILABLE = new Set([1801, 1905, 1906]);

function win32CodeFromPrintError(msg: string): number {
  const m =
    msg.match(/OpenPrinter failed for '[^']+' \(Win32=(\d+)\)/i) ||
    msg.match(/StartDocPrinter failed for '[^']+' \(Win32=(\d+)\)/i) ||
    msg.match(/StartPagePrinter failed for '[^']+' \(Win32=(\d+)\)/i) ||
    msg.match(/WritePrinter failed for '[^']+' \(Win32=(\d+)\)/i);
  if (m) return Number(m[1]) || 0;
  const generic = msg.match(/Win32\s*[=:]?\s*(\d+)/i);
  return generic ? Number(generic[1]) || 0 : 0;
}

/** Win32 1801/1905/1906 — agent is up, printer queue is missing or unusable. */
export function isPrinterDisconnectedError(raw: unknown): boolean {
  const msg = collectPrintErrorText(raw);
  if (WIN32_PRINTER_UNAVAILABLE.has(win32CodeFromPrintError(msg))) return true;
  return /error_invalid_printer_name|error_printer_deleted|error_invalid_printer_state|not found or disconnected|openprinter failed|startdocprinter failed|GLPrinter\d*|ERROR_INVALID_PRINTER_NAME/i.test(
    msg
  );
}

export function isNoisyPrintAgentDump(raw: unknown): boolean {
  const msg = collectPrintErrorText(raw);
  return /command failed|powershell\.exe|-noprofile|executionpolicy|win-raw-print|win-scale-read|categoryinfo|fullyqualifiederrorid|reborn-print-|manupos-print-|chaslayprintagent|at c:\\|\\temp\\|-\s*file\s+c:\\|\.ps1\b/i.test(
    msg
  );
}

export function compareAgentVersion(version: string, minimum: string): number {
  const a = String(version || '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const b = String(minimum || '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** HTTP agents below MIN (or no version) still use manupos-print-* temps. Electron bridge is current. */
export function isPrintAgentVersionOutdated(version?: string | null): boolean {
  if (typeof window !== 'undefined' && window.manuposDesktop) return false;
  if (!version || !String(version).trim()) return true;
  return compareAgentVersion(String(version).trim(), MIN_PRINT_AGENT_VERSION) < 0;
}

/** Collapse PowerShell / Win32 dumps into a one-line Reborn message. */
export function friendlyPrintAgentError(raw: unknown, printerName?: string): string {
  const msg = collectPrintErrorText(raw);
  if (!msg) return 'Print failed';
  const name = extractPrinterNameFromError(msg, printerName);
  const code = win32CodeFromPrintError(msg);
  if (WIN32_PRINTER_UNAVAILABLE.has(code) || isPrinterDisconnectedError(msg)) {
    return name ? `Printer '${name}' not found or disconnected` : 'Printer not found or disconnected';
  }
  if (isNoisyPrintAgentDump(msg)) {
    return name ? `Printer '${name}' not found or disconnected` : 'Print failed';
  }
  return msg.length > 220 ? 'Print failed' : msg;
}

async function agentFetch(path: string, init?: RequestInit, printerName?: string) {
  const res = await fetch(`${PRINT_AGENT_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      friendlyPrintAgentError(
        collectPrintErrorText(err) || `Print agent HTTP ${res.status}`,
        printerName
      )
    );
  }
  return res.json();
}

export type PrintAgentHealth = {
  ok: boolean;
  version?: string;
};

export async function getPrintAgentHealth(): Promise<PrintAgentHealth> {
  if (window.manuposDesktop) {
    try {
      const s = await window.manuposDesktop.getAgentStatus();
      return { ok: !!s.running };
    } catch {
      return { ok: true };
    }
  }
  try {
    const data = await agentFetch('/health');
    return {
      ok: !!data.ok,
      version: data.version != null ? String(data.version) : undefined,
    };
  } catch {
    return { ok: false };
  }
}

export async function isPrintAgentAvailable(): Promise<boolean> {
  const health = await getPrintAgentHealth();
  return health.ok;
}

export async function listAgentPrinters(): Promise<AgentPrinter[]> {
  if (window.manuposDesktop?.listPrinters) {
    const list = await window.manuposDesktop.listPrinters();
    return normalizeAgentPrinterList(
      (list || []).map((p) => ({
        ...p,
        unsuitableForRaw: p.unsuitableForRaw ?? isUnsuitableRawPrinter(p.name),
      }))
    );
  }
  const data = await agentFetch('/printers');
  return normalizeAgentPrinterList(
    (data.printers || []).map((p: AgentPrinter) => ({
      ...p,
      unsuitableForRaw: p.unsuitableForRaw ?? isUnsuitableRawPrinter(p.name),
    }))
  );
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
      `Printer name looks corrupted ('${name}'). Re-select the printer in Reborn after updating the Print Agent.`
    );
  }

  if (window.manuposDesktop?.printEscPos) {
    const res = await window.manuposDesktop.printEscPos(opts);
    if (!res.ok) {
      throw new Error(friendlyPrintAgentError(res.error || 'Desktop print failed', name));
    }
    if (res.printer && isUnsuitableRawPrinter(res.printer)) {
      throw new Error(unsuitableRawPrinterMessage(res.printer));
    }
    return { ok: true, printer: res.printer };
  }
  const data = await agentFetch(
    '/print',
    {
      method: 'POST',
      body: JSON.stringify({
        printerName: opts.printerName || undefined,
        dataBase64: opts.dataBase64,
        text: opts.text,
      }),
    },
    name
  );
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
    await agentFetch(
      '/drawer',
      {
        method: 'POST',
        body: JSON.stringify({ printerName }),
      },
      printerName
    );
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

export function formatScaleDeviceLabel(device: ScaleDevice | string): string {
  if (typeof device === 'string') return formatScalePortLabel(device);
  const port = formatScalePortLabel(device.port || '');
  const name = String(device.name || device.caption || '')
    .replace(/\s*\(COM\d+\)\s*$/i, '')
    .trim();
  if (name && port && !stableDeviceKey(name).includes(stableDeviceKey(port))) {
    return `${name} · ${port}`;
  }
  return name || port;
}

export function resolveScaleDevice(
  configured: { port?: string | null; name?: string | null; deviceId?: string | null },
  devices: ScaleDevice[]
): ScaleDevice | null {
  if (!devices.length) return null;
  const wantPort = formatScalePortLabel(configured.port || '');
  const wantId = String(configured.deviceId || '').trim().toLowerCase();
  const wantName = stableDeviceKey(configured.name || '');
  if (wantId) {
    const byId = devices.find((d) => String(d.pnpDeviceId || '').toLowerCase() === wantId);
    if (byId) return byId;
  }
  if (wantName) {
    const scored = devices
      .map((d) => ({
        d,
        score: Math.max(
          scoreDeviceName(wantName, stableDeviceKey(d.name)),
          scoreDeviceName(wantName, stableDeviceKey(d.caption)),
          scoreDeviceName(wantName, stableDeviceKey(d.manufacturer))
        ),
      }))
      .filter((x) => x.score >= 8)
      .sort((a, b) => b.score - a.score);
    if (scored[0]) return scored[0].d;
  }
  if (wantPort) {
    const byPort = devices.find((d) => formatScalePortLabel(d.port) === wantPort);
    if (byPort) return byPort;
  }
  return null;
}

function scoreDeviceName(want: string, have: string): number {
  if (!want || !have) return 0;
  if (want === have) return 16;
  if (have.includes(want) || want.includes(have)) return 10;
  return 0;
}

/** Windows COM ports from Print Agent (Aclas USB-serial → COMx). */
export async function listScalePorts(): Promise<string[]> {
  const { ports } = await listScaleDevices();
  return ports;
}

export async function listScaleDevices(): Promise<{ ports: string[]; devices: ScaleDevice[] }> {
  try {
    const data = await agentFetch('/scale/ports');
    const devices: ScaleDevice[] = Array.isArray(data?.devices)
      ? data.devices.map((d: any) => ({
          port: formatScalePortLabel(String(d.port || d.name || '')),
          caption: d.caption ? String(d.caption) : undefined,
          manufacturer: d.manufacturer ? String(d.manufacturer) : undefined,
          pnpDeviceId: d.pnpDeviceId ? String(d.pnpDeviceId) : undefined,
          name: d.name ? String(d.name) : undefined,
        }))
      : [];
    const ports = Array.isArray(data?.ports)
      ? data.ports.map((p: unknown) => formatScalePortLabel(String(p)))
      : devices.map((d) => d.port).filter(Boolean);
    return { ports, devices };
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/HTTP 404|Cannot GET \/scale\/ports/i.test(msg)) {
      throw new Error(
        'Print Agent is outdated — reinstall Reborn Print Agent to enable scale support.'
      );
    }
    throw e;
  }
}

/** One Aclas reading from Print Agent (null if no frame yet). */
export async function readScaleWeight(
  port: string,
  timeoutMs = 2500,
  opts?: { hint?: string | null; deviceId?: string | null }
): Promise<{ reading: ScaleReading | null; message?: string; resolvedPort?: string }> {
  const normalized = normalizeScalePort(port);
  if (!normalized && !opts?.hint && !opts?.deviceId) {
    throw new Error('COM port required (e.g. COM3)');
  }
  const q = new URLSearchParams({
    timeoutMs: String(timeoutMs),
  });
  if (normalized) q.set('port', normalized);
  if (opts?.hint) q.set('hint', String(opts.hint));
  if (opts?.deviceId) q.set('deviceId', String(opts.deviceId));
  const data = await agentFetch(`/scale/reading?${q.toString()}`);
  return {
    reading: (data?.reading as ScaleReading | null) || null,
    message: data?.message ? String(data.message) : undefined,
    resolvedPort: data?.resolvedPort ? formatScalePortLabel(String(data.resolvedPort)) : undefined,
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
