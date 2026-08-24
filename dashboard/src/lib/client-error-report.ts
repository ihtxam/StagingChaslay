import toast from 'react-hot-toast';
import api from '@/lib/api';

type PendingError = {
  level: 'error' | 'warn';
  message: string;
  source: string;
  path: string;
  metadata?: Record<string, unknown>;
};

const FLUSH_MS = 4000;
const MAX_BATCH = 20;
const MAX_MESSAGE = 2000;

let pending: PendingError[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function normalizeMessage(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().slice(0, MAX_MESSAGE);
  if (value instanceof Error) return value.message.trim().slice(0, MAX_MESSAGE);
  try {
    return JSON.stringify(value).slice(0, MAX_MESSAGE);
  } catch {
    return String(value).slice(0, MAX_MESSAGE);
  }
}

function enqueue(entry: PendingError) {
  const msg = normalizeMessage(entry.message);
  if (!msg) return;
  pending.push({ ...entry, message: msg });
  if (pending.length >= MAX_BATCH) {
    void flushClientErrors();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushClientErrors();
    }, FLUSH_MS);
  }
}

export async function flushClientErrors(): Promise<void> {
  if (!pending.length) return;
  const batch = pending.splice(0, MAX_BATCH);
  try {
    await api.post('/merchant/client-errors', { errors: batch });
  } catch {
    /* best-effort — avoid error loops */
  }
}

export function reportClientError(
  message: unknown,
  opts?: { source?: string; level?: 'error' | 'warn'; metadata?: Record<string, unknown> }
) {
  enqueue({
    level: opts?.level || 'error',
    message: normalizeMessage(message),
    source: opts?.source || 'app',
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    metadata: opts?.metadata,
  });
}

/** Patch toast.error (and optionally toast) to forward merchant UI errors to superadmin logs. */
export function initClientErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalError = toast.error.bind(toast);
  toast.error = ((message: unknown, opts?: Parameters<typeof toast.error>[1]) => {
    reportClientError(message, { source: 'toast.error' });
    return originalError(message as Parameters<typeof toast.error>[0], opts);
  }) as typeof toast.error;

  window.addEventListener('error', (ev) => {
    reportClientError(ev.message || 'Script error', {
      source: 'window.error',
      metadata: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    reportClientError(ev.reason, { source: 'unhandledrejection' });
  });
}
