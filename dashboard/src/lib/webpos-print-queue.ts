/**
 * Persistent unprinted ESC/POS jobs for WebPOS.
 * Survives cart reset after Send/Pay. Auto-retries on a configurable interval while the page is open.
 */
import { useEffect, useState } from 'react';
import { friendlyPrintAgentError, printViaAgent } from '@/lib/print-agent';

function safeJobError(error: unknown, printerName?: string): string {
  return friendlyPrintAgentError(error, printerName);
}

export type PendingPrintKind = 'kitchen' | 'receipt' | 'eod' | 'other';

export type PendingPrintJob = {
  id: string;
  kind: PendingPrintKind;
  label: string;
  createdAt: number;
  lastAttemptAt?: number;
  attempts: number;
  lastError?: string;
  dataBase64: string;
  printerName?: string;
  text?: string;
  orderId?: string | null;
  lineIds?: string[];
  /** Set when auto-retry budget is used up — show error UI and allow manual reprint. */
  exhausted?: boolean;
};

export type PrintQueueRetryConfig = {
  enabled: boolean;
  maxAttempts: number;
  intervalMs: number;
};

const DEFAULT_RETRY_CONFIG: PrintQueueRetryConfig = {
  enabled: true,
  maxAttempts: 5,
  intervalMs: 5000,
};

/** @deprecated use getPrintQueueRetryConfig().intervalMs */
export const PRINT_QUEUE_RETRY_MS = DEFAULT_RETRY_CONFIG.intervalMs;

const STORAGE_KEY = 'chaslayreborn_webpos_print_queue_v1';
const MAX_JOBS = 40;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

type Listener = (jobs: PendingPrintJob[]) => void;
type ExhaustedListener = (job: PendingPrintJob) => void;

const listeners = new Set<Listener>();
const exhaustedListeners = new Set<ExhaustedListener>();

let jobs: PendingPrintJob[] = loadJobs();
let retryTimer: number | null = null;
let retryInFlight = false;
let retryConfig: PrintQueueRetryConfig = { ...DEFAULT_RETRY_CONFIG };

function loadJobs(): PendingPrintJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingPrintJob[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed
      .filter((j) => j && typeof j.id === 'string' && typeof j.dataBase64 === 'string')
      .filter((j) => (j.createdAt || 0) >= cutoff)
      .slice(0, MAX_JOBS)
      .map((j) =>
        j.lastError ? { ...j, lastError: safeJobError(j.lastError, j.printerName) } : j
      );
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* quota / private mode */
  }
  for (const fn of listeners) {
    try {
      fn(jobs);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function getPrintQueueRetryConfig(): PrintQueueRetryConfig {
  return retryConfig;
}

export function setPrintQueueRetryConfig(partial: Partial<PrintQueueRetryConfig>) {
  const prevInterval = retryConfig.intervalMs;
  retryConfig = {
    enabled: partial.enabled ?? retryConfig.enabled,
    maxAttempts: partial.maxAttempts ?? retryConfig.maxAttempts,
    intervalMs: partial.intervalMs ?? retryConfig.intervalMs,
  };
  if (partial.intervalMs != null && partial.intervalMs !== prevInterval) {
    restartPrintQueueAutoRetry();
  }
}

export function applyKitchenPrintRetryFromSettings(settings?: {
  kitchenPrintRetryEnabled?: boolean;
  kitchenPrintRetryAttempts?: number;
  kitchenPrintRetryIntervalSec?: number;
} | null) {
  setPrintQueueRetryConfig({
    enabled: settings?.kitchenPrintRetryEnabled !== false,
    maxAttempts: clampInt(settings?.kitchenPrintRetryAttempts, 1, 20, 5),
    intervalMs: clampInt(settings?.kitchenPrintRetryIntervalSec, 2, 60, 5) * 1000,
  });
}

function shouldExhaust(job: PendingPrintJob): boolean {
  if (!retryConfig.enabled) return true;
  return (job.attempts || 0) >= retryConfig.maxAttempts;
}

function notifyExhausted(job: PendingPrintJob) {
  for (const fn of exhaustedListeners) {
    try {
      fn(job);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function markExhausted(job: PendingPrintJob) {
  if (job.exhausted) return;
  job.exhausted = true;
  notifyExhausted(job);
}

export function subscribePrintJobExhausted(fn: ExhaustedListener): () => void {
  exhaustedListeners.add(fn);
  return () => {
    exhaustedListeners.delete(fn);
  };
}

export function listPendingPrintJobs(): PendingPrintJob[] {
  return jobs;
}

export function listExhaustedPrintJobs(): PendingPrintJob[] {
  return jobs.filter((j) => j.exhausted);
}

export function listRetryingPrintJobs(): PendingPrintJob[] {
  return jobs.filter((j) => !j.exhausted);
}

export function hasKitchenRetryPending(lineIds?: Iterable<string>): boolean {
  const ids = lineIds ? new Set(lineIds) : null;
  return jobs.some((j) => {
    if (j.kind !== 'kitchen' || j.exhausted) return false;
    if (!retryConfig.enabled) return false;
    if ((j.attempts || 0) >= retryConfig.maxAttempts) return false;
    if (!ids) return true;
    return (j.lineIds || []).some((id) => ids.has(id));
  });
}

export function subscribePrintQueue(fn: Listener): () => void {
  listeners.add(fn);
  fn(jobs);
  return () => {
    listeners.delete(fn);
  };
}

export function usePendingPrintJobs(): PendingPrintJob[] {
  const [list, setList] = useState<PendingPrintJob[]>(jobs);
  useEffect(() => subscribePrintQueue(setList), []);
  return list;
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `print-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueueFailedPrintJob(input: {
  kind?: PendingPrintKind;
  label?: string;
  dataBase64: string;
  printerName?: string;
  text?: string;
  orderId?: string | null;
  lineIds?: string[];
  error?: unknown;
}): PendingPrintJob {
  const lastError = safeJobError(input.error, input.printerName);
  const existing = jobs.find(
    (j) => j.dataBase64 === input.dataBase64 && (j.printerName || '') === (input.printerName || '')
  );
  if (existing) {
    existing.lastError = lastError || existing.lastError;
    existing.lastAttemptAt = Date.now();
    existing.attempts = (existing.attempts || 0) + 1;
    if (input.lineIds?.length) {
      existing.lineIds = Array.from(new Set([...(existing.lineIds || []), ...input.lineIds]));
    }
    if (shouldExhaust(existing)) markExhausted(existing);
    persist();
    ensurePrintQueueAutoRetry();
    return existing;
  }

  const job: PendingPrintJob = {
    id: newId(),
    kind: input.kind || 'other',
    label: (input.label || '').trim() || defaultLabel(input.kind || 'other', input.orderId),
    createdAt: Date.now(),
    lastAttemptAt: Date.now(),
    attempts: 1,
    lastError: lastError || undefined,
    dataBase64: input.dataBase64,
    printerName: input.printerName || undefined,
    text: input.text,
    orderId: input.orderId || null,
    lineIds: input.lineIds?.length ? [...input.lineIds] : undefined,
    exhausted: false,
  };
  if (shouldExhaust(job)) markExhausted(job);
  jobs = [job, ...jobs].slice(0, MAX_JOBS);
  persist();
  ensurePrintQueueAutoRetry();
  return job;
}

function defaultLabel(kind: PendingPrintKind, orderId?: string | null): string {
  const ticket = (orderId || '').trim();
  if (kind === 'kitchen') return ticket ? `Kitchen · ${ticket}` : 'Kitchen';
  if (kind === 'receipt') return ticket ? `Receipt · ${ticket}` : 'Receipt';
  if (kind === 'eod') return 'End of day';
  return ticket || 'Print job';
}

export function removePrintJobs(ids: Iterable<string>) {
  const idSet = new Set(ids);
  const next = jobs.filter((j) => !idSet.has(j.id));
  if (next.length === jobs.length) return;
  jobs = next;
  persist();
}

export async function reprintPrintJobs(ids: Iterable<string>): Promise<{ ok: number; failed: number }> {
  const idSet = new Set(ids);
  const targets = jobs.filter((j) => idSet.has(j.id));
  let ok = 0;
  let failed = 0;
  for (const job of targets) {
    try {
      await printViaAgent({
        printerName: job.printerName,
        dataBase64: job.dataBase64,
        text: job.text,
      });
      removePrintJobs([job.id]);
      ok += 1;
    } catch (e: unknown) {
      job.lastError = safeJobError(e, job.printerName) || job.lastError;
      job.lastAttemptAt = Date.now();
      job.attempts = (job.attempts || 0) + 1;
      job.exhausted = false;
      if (shouldExhaust(job)) markExhausted(job);
      failed += 1;
    }
  }
  if (failed) persist();
  return { ok, failed };
}

async function autoRetryOnce(): Promise<number> {
  if (retryInFlight || !jobs.length) return 0;
  retryInFlight = true;
  let printed = 0;
  try {
    const snapshot = [...jobs];
    for (const job of snapshot) {
      if (job.exhausted) continue;
      if (!retryConfig.enabled) {
        markExhausted(job);
        continue;
      }
      if ((job.attempts || 0) >= retryConfig.maxAttempts) {
        markExhausted(job);
        continue;
      }
      try {
        await printViaAgent({
          printerName: job.printerName,
          dataBase64: job.dataBase64,
          text: job.text,
        });
        removePrintJobs([job.id]);
        printed += 1;
      } catch (e: unknown) {
        job.lastError = safeJobError(e, job.printerName) || job.lastError;
        job.lastAttemptAt = Date.now();
        job.attempts = (job.attempts || 0) + 1;
        if (shouldExhaust(job)) markExhausted(job);
      }
    }
    if (printed === 0 && snapshot.some((j) => !j.exhausted)) persist();
  } finally {
    retryInFlight = false;
  }
  return printed;
}

function restartPrintQueueAutoRetry() {
  if (typeof window === 'undefined') return;
  if (retryTimer != null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  ensurePrintQueueAutoRetry();
}

export function ensurePrintQueueAutoRetry() {
  if (typeof window === 'undefined') return;
  if (retryTimer != null) return;
  const tick = () => {
    void autoRetryOnce().finally(() => {
      retryTimer = window.setTimeout(tick, retryConfig.intervalMs);
    });
  };
  retryTimer = window.setTimeout(tick, retryConfig.intervalMs);
}

export function startPrintQueueAutoRetry() {
  ensurePrintQueueAutoRetry();
  if (jobs.some((j) => !j.exhausted)) void autoRetryOnce();
}
