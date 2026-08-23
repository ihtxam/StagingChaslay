const LOG_KEY = 'webpos_session_logs';
const MAX_ENTRIES = 400;

export type WebPosLogLevel = 'info' | 'warn' | 'error';

export type WebPosLogEntry = {
  ts: string;
  level: WebPosLogLevel;
  message: string;
};

function readRaw(): WebPosLogEntry[] {
  try {
    const raw = sessionStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebPosLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: WebPosLogEntry[]) {
  try {
    sessionStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

export function appendWebPosLog(message: string, level: WebPosLogLevel = 'info') {
  const entry: WebPosLogEntry = {
    ts: new Date().toISOString(),
    level,
    message: String(message || '').slice(0, 2000),
  };
  writeRaw([...readRaw(), entry]);
}

export function readWebPosLogs(): WebPosLogEntry[] {
  return readRaw();
}

export function clearWebPosLogs() {
  try {
    sessionStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}

export function formatWebPosLogsText(entries: WebPosLogEntry[]): string {
  return entries
    .map((e) => `${e.ts} [${e.level.toUpperCase()}] ${e.message}`)
    .join('\n');
}

export type WebPosDiagnostics = {
  userAgent: string;
  url: string;
  online: boolean;
  standalone: boolean;
  locale?: string;
  staffName?: string | null;
  staffRole?: string | null;
  merchantName?: string | null;
  appVersion?: string;
};

export function buildWebPosDiagnostics(extra: Partial<WebPosDiagnostics> = {}): WebPosDiagnostics {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    standalone:
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true),
    ...extra,
  };
}

export function buildSupportLogPayload(
  entries: WebPosLogEntry[],
  diagnostics: WebPosDiagnostics
): string {
  const header = `--- Chaslay WebPOS diagnostics ---\n${JSON.stringify(diagnostics, null, 2)}\n--- Session log ---\n`;
  const body = formatWebPosLogsText(entries);
  return `${header}${body || '(no log entries yet)'}`;
}

/** POST session logs to merchant support (no modal). */
export async function sendWebPosLogsToSupport(
  diagnostics: Partial<WebPosDiagnostics> & { appVersion?: string }
): Promise<void> {
  const { default: api } = await import('@/lib/api');
  const { webPosVersionLabel } = await import('@/lib/app-version');
  const entries = readWebPosLogs();
  const full = buildWebPosDiagnostics({
    appVersion: webPosVersionLabel,
    ...diagnostics,
  });
  const body = buildSupportLogPayload(entries, full);
  await api.post('/merchant/support/tickets', {
    category: 'technical',
    subcategory: 'webpos',
    subject: `WebPOS logs — ${new Date().toLocaleString()}`,
    body,
  });
}

let consoleHooked = false;

/** Capture console.warn/error into the session log ring buffer. */
export function hookWebPosConsole() {
  if (consoleHooked || typeof window === 'undefined') return;
  consoleHooked = true;
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    appendWebPosLog(args.map(String).join(' '), 'warn');
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    appendWebPosLog(args.map(String).join(' '), 'error');
    origError(...args);
  };
}
