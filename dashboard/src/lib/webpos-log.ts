const LOG_KEY = 'webpos_session_logs';
const LEGACY_SESSION_KEY = 'webpos_session_logs';
const AUTO_SEND_TS_KEY = 'webpos_last_auto_send_at';
const MAX_ENTRIES = 600;
const RETENTION_MS = 60 * 60 * 1000;
const AUTO_SEND_COOLDOWN_MS = 15 * 60 * 1000;

export type WebPosLogLevel = 'info' | 'warn' | 'error';

export type WebPosLogEntry = {
  ts: string;
  level: WebPosLogLevel;
  category?: string;
  message: string;
};

export type WebPosLogCategory =
  | 'session'
  | 'payment'
  | 'print'
  | 'kitchen'
  | 'sync'
  | 'offline'
  | 'shift'
  | 'terminal'
  | 'order'
  | 'load'
  | 'staff'
  | 'error'
  | 'api';

function readStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function migrateLegacySessionLogs() {
  if (typeof window === 'undefined') return;
  try {
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacy) return;
    const store = readStorage();
    if (!store) return;
    const existing = store.getItem(LOG_KEY);
    const legacyEntries = JSON.parse(legacy) as WebPosLogEntry[];
    const currentEntries = existing ? (JSON.parse(existing) as WebPosLogEntry[]) : [];
    const merged = pruneEntries([...currentEntries, ...(Array.isArray(legacyEntries) ? legacyEntries : [])]);
    store.setItem(LOG_KEY, JSON.stringify(merged));
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore migration errors */
  }
}

function pruneEntries(entries: WebPosLogEntry[]): WebPosLogEntry[] {
  const cutoff = Date.now() - RETENTION_MS;
  return entries
    .filter((e) => {
      const ts = Date.parse(e.ts);
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .slice(-MAX_ENTRIES);
}

function readRaw(): WebPosLogEntry[] {
  migrateLegacySessionLogs();
  const store = readStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebPosLogEntry[];
    const pruned = pruneEntries(Array.isArray(parsed) ? parsed : []);
    if (pruned.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
      store.setItem(LOG_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
}

function writeRaw(entries: WebPosLogEntry[]) {
  const store = readStorage();
  if (!store) return;
  try {
    store.setItem(LOG_KEY, JSON.stringify(pruneEntries(entries)));
  } catch {
    /* quota */
  }
}

export function appendWebPosLog(
  message: string,
  level: WebPosLogLevel = 'info',
  category?: WebPosLogCategory | string
) {
  const entry: WebPosLogEntry = {
    ts: new Date().toISOString(),
    level,
    category: category || undefined,
    message: String(message || '').slice(0, 2000),
  };
  writeRaw([...readRaw(), entry]);
}

export function logWebPosEvent(
  category: WebPosLogCategory | string,
  message: string,
  level: WebPosLogLevel = 'info'
) {
  appendWebPosLog(message, level, category);
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const stack = err.stack ? `\n${err.stack.slice(0, 800)}` : '';
    return `${err.name}: ${err.message}${stack}`;
  }
  if (typeof err === 'object' && err && 'response' in err) {
    const ax = err as {
      response?: { status?: number; data?: { error?: string; code?: string } };
      message?: string;
    };
    const status = ax.response?.status;
    const code = ax.response?.data?.code;
    const msg = ax.response?.data?.error || ax.message || String(err);
    return [status ? `HTTP ${status}` : null, code, msg].filter(Boolean).join(' — ');
  }
  return String(err);
}

/** Log an error and optionally auto-send to superadmin (rate-limited, silent). */
export function logWebPosError(
  category: WebPosLogCategory | string,
  message: string,
  err?: unknown,
  opts?: { autoSend?: boolean }
) {
  const detail = err != null ? `: ${formatError(err)}` : '';
  appendWebPosLog(`${message}${detail}`, 'error', category);
  if (opts?.autoSend) {
    void triggerAutoSend(`${category}: ${message}`, err);
  }
}

/** Last hour of log entries (also capped by MAX_ENTRIES). */
export function readWebPosLogs(): WebPosLogEntry[] {
  return readRaw();
}

export function clearWebPosLogs() {
  const store = readStorage();
  if (!store) return;
  try {
    store.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}

export function formatWebPosLogsText(entries: WebPosLogEntry[]): string {
  return entries
    .map((e) => {
      const cat = e.category ? `[${e.category}] ` : '';
      return `${e.ts} [${e.level.toUpperCase()}] ${cat}${e.message}`;
    })
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
  autoReportReason?: string;
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
  const header = `--- Chaslay WebPOS diagnostics ---\n${JSON.stringify(diagnostics, null, 2)}\n--- Session log (last hour) ---\n`;
  const body = formatWebPosLogsText(entries);
  return `${header}${body || '(no log entries in the last hour)'}`;
}

export type SendWebPosLogsOptions = {
  auto?: boolean;
  reason?: string;
};

/** POST session logs to superadmin support inbox (not merchant-visible). Silent — no UI feedback. */
export async function sendWebPosLogsToSupport(
  diagnostics: Partial<WebPosDiagnostics> & { appVersion?: string },
  opts?: SendWebPosLogsOptions
): Promise<void> {
  const { default: api } = await import('@/lib/api');
  const { webPosVersionLabel } = await import('@/lib/app-version');
  const entries = readWebPosLogs();
  const full = buildWebPosDiagnostics({
    appVersion: webPosVersionLabel,
    autoReportReason: opts?.reason,
    ...diagnostics,
  });
  const body = buildSupportLogPayload(entries, full);
  const when = new Date().toLocaleString();
  const subject = opts?.auto
    ? `WebPOS auto-report — ${opts.reason || 'error'} (${when})`
    : `WebPOS logs — ${when}`;
  await api.post('/merchant/support/diagnostic-report', {
    source: 'webpos',
    subject,
    body,
    auto: !!opts?.auto,
  });
}

let consoleHooked = false;
let globalErrorsHooked = false;
let diagnosticsGetter: (() => Partial<WebPosDiagnostics>) | null = null;

async function triggerAutoSend(reason: string, err?: unknown) {
  if (err != null) {
    appendWebPosLog(`Auto-report trigger: ${formatError(err)}`, 'error', 'error');
  }
  const now = Date.now();
  try {
    const last = Number(sessionStorage.getItem(AUTO_SEND_TS_KEY) || '0');
    if (now - last < AUTO_SEND_COOLDOWN_MS) {
      appendWebPosLog(`Auto-report skipped (cooldown): ${reason}`, 'warn', 'session');
      return;
    }
    sessionStorage.setItem(AUTO_SEND_TS_KEY, String(now));
  } catch {
    return;
  }

  try {
    await sendWebPosLogsToSupport(diagnosticsGetter?.() || {}, { auto: true, reason });
  } catch (sendErr) {
    appendWebPosLog(`Auto-report send failed: ${formatError(sendErr)}`, 'error', 'error');
  }
}

/** Capture console.warn/error into the log ring buffer. */
export function hookWebPosConsole() {
  if (consoleHooked || typeof window === 'undefined') return;
  consoleHooked = true;
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    appendWebPosLog(args.map(String).join(' '), 'warn', 'api');
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    appendWebPosLog(args.map(String).join(' '), 'error', 'error');
    origError(...args);
  };
}

function hookGlobalErrors() {
  if (globalErrorsHooked || typeof window === 'undefined') return;
  globalErrorsHooked = true;

  window.addEventListener('error', (event) => {
    const msg = event.message || String(event.error || 'Unknown error');
    logWebPosError('error', `Uncaught: ${msg}`, event.error, { autoSend: true });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logWebPosError('error', 'Unhandled promise rejection', event.reason, { autoSend: true });
  });

  window.addEventListener('online', () => {
    logWebPosEvent('offline', 'Browser back online');
  });
  window.addEventListener('offline', () => {
    logWebPosEvent('offline', 'Browser offline', 'warn');
  });
}

let loggingInitialized = false;

/** Start WebPOS logging: console, global errors, online/offline. */
export function initWebPosLogging(opts: {
  getDiagnostics: () => Partial<WebPosDiagnostics>;
}) {
  diagnosticsGetter = opts.getDiagnostics;
  if (!loggingInitialized) {
    loggingInitialized = true;
    hookWebPosConsole();
    hookGlobalErrors();
    logWebPosEvent('session', 'WebPOS session started');
  }
}
