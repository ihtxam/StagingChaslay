/**
 * Persistent unprinted ESC/POS jobs for WebPOS.
 * Survives cart reset after Send/Pay. Auto-retries every 8s while the page is open.
 */
import { useEffect, useState } from 'react';
import { printViaAgent } from '@/lib/print-agent';

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
};

const STORAGE_KEY = 'chaslayreborn_webpos_print_queue_v1';
export const PRINT_QUEUE_RETRY_MS = 8000;
const MAX_JOBS = 40;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

type Listener = (jobs: PendingPrintJob[]) => void;
const listeners = new Set<Listener>();

let jobs: PendingPrintJob[] = loadJobs();
let retryTimer: number | null = null;
let retryInFlight = false;

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
      .slice(0, MAX_JOBS);
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

export function listPendingPrintJobs(): PendingPrintJob[] {
  return jobs;
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
  const lastError = String(
    (input.error as { message?: string })?.message || input.error || ''
  ).trim();
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
  };
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
      job.lastError = String((e as { message?: string })?.message || e || '').trim() || job.lastError;
      job.lastAttemptAt = Date.now();
      job.attempts = (job.attempts || 0) + 1;
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
      try {
        await printViaAgent({
          printerName: job.printerName,
          dataBase64: job.dataBase64,
          text: job.text,
        });
        removePrintJobs([job.id]);
        printed += 1;
      } catch (e: unknown) {
        job.lastError = String((e as { message?: string })?.message || e || '').trim() || job.lastError;
        job.lastAttemptAt = Date.now();
        job.attempts = (job.attempts || 0) + 1;
      }
    }
    if (printed === 0 && snapshot.length) persist();
  } finally {
    retryInFlight = false;
  }
  return printed;
}

export function ensurePrintQueueAutoRetry() {
  if (typeof window === 'undefined') return;
  if (retryTimer != null) return;
  const tick = () => {
    void autoRetryOnce().finally(() => {
      retryTimer = window.setTimeout(tick, PRINT_QUEUE_RETRY_MS);
    });
  };
  retryTimer = window.setTimeout(tick, PRINT_QUEUE_RETRY_MS);
}

export function startPrintQueueAutoRetry() {
  ensurePrintQueueAutoRetry();
  if (jobs.length) void autoRetryOnce();
}
