import api from '@/lib/api';
import { isPrintAgentAvailable, printViaAgent } from '@/lib/print-agent';
import { enqueueFailedPrintJob } from '@/lib/webpos-print-queue';
import { isBrowserOnline } from '@/lib/webpos-offline/types';
import {
  processAutoPrintOrderJob,
  processAutoPrintReservationJob,
  type AutoPrintOrderPayload,
  type AutoPrintReservationPayload,
} from '@/lib/external-order-auto-print';

const DEVICE_KEY = 'manupos_webpos_device_id';

export function webPosDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `webpos-${Date.now()}`;
  }
}

export type EscPosPrintJobPayload = {
  kind: 'escpos';
  dataBase64: string;
  printerName?: string;
  text?: string;
};

/** Queue raw ESC/POS for the main till (browser with Print Agent online). */
export async function enqueueEscPosPrintJob(opts: {
  dataBase64: string;
  printerName?: string;
  text?: string;
  orderId?: string | null;
}): Promise<{ jobId: string }> {
  const payload: EscPosPrintJobPayload = {
    kind: 'escpos',
    dataBase64: opts.dataBase64,
    printerName: opts.printerName || undefined,
    text: opts.text,
  };
  const res = await api.post('/merchant/pos/print-jobs', {
    jobType: 'ESCPOS',
    payload,
    sourceDeviceId: webPosDeviceId(),
    orderId: opts.orderId || null,
  });
  return { jobId: String(res.data?.jobId || '') };
}

export type PrintJobKind = 'kitchen' | 'receipt' | 'eod' | 'other';

/**
 * True when this browser is the register PC (local Print Agent + 8s retry queue).
 * Phones and narrow WebPOS layouts without a local agent queue jobs to the main till.
 */
export function isLocalPrintStation(agentOnline: boolean): boolean {
  if (agentOnline) return true;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent || '';
  if (/Mobile|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua)) return false;
  if (window.matchMedia && !window.matchMedia('(min-width: 1024px)').matches) return false;
  return true;
}

/** Whether failed/offline prints should retry on this machine vs queue for the main till. */
export function resolvePrintRetryLocally(agentOnline: boolean): boolean {
  return isLocalPrintStation(agentOnline);
}

/**
 * Print via local Print Agent when available; otherwise queue for the main till hub.
 * On local failure (or agent down with retryLocally), persists the job for 8s auto-retry.
 * Returns `'local' | 'queued'`.
 */
export async function printViaAgentOrQueue(opts: {
  dataBase64: string;
  printerName?: string;
  text?: string;
  orderId?: string | null;
  /** Force queue even if agent looks online (tests). */
  forceQueue?: boolean;
  /**
   * Persist + auto-retry on this PC when local print fails or the agent is down.
   * Default true (WebPOS till). Waiter phones pass false so jobs go to the main till.
   */
  retryLocally?: boolean;
  jobKind?: PrintJobKind;
  jobLabel?: string;
  lineIds?: string[];
}): Promise<'local' | 'queued'> {
  const retryLocally = opts.retryLocally !== false;
  const persistLocal = (error: unknown) => {
    if (!opts.dataBase64) return;
    enqueueFailedPrintJob({
      kind: opts.jobKind,
      label: opts.jobLabel,
      dataBase64: opts.dataBase64,
      printerName: opts.printerName,
      text: opts.text,
      orderId: opts.orderId,
      lineIds: opts.lineIds,
      error,
    });
  };

  const agentReady = !opts.forceQueue && (await isPrintAgentAvailable());
  if (agentReady) {
    try {
      await printViaAgent({
        printerName: opts.printerName,
        dataBase64: opts.dataBase64,
        text: opts.text,
      });
      return 'local';
    } catch (e) {
      if (retryLocally) persistLocal(e);
      throw e;
    }
  }

  const offlineErr = new Error(
    retryLocally
      ? 'Print agent offline — start Chaslay Print Agent on this PC to print.'
      : 'Network required — connect to send prints to the main till.'
  );
  if (retryLocally || !isBrowserOnline()) {
    persistLocal(offlineErr);
    throw offlineErr;
  }

  await enqueueEscPosPrintJob(opts);
  return 'queued';
}

type PendingJob = {
  id: string;
  sourceDeviceId?: string;
  payload?: EscPosPrintJobPayload | Record<string, unknown> | null;
};

export type ProcessEscPosPrintJobsResult = {
  /** Jobs physically printed and acked. */
  done: number;
  /** Kitchen jobs from another device (waiter phone / mobile WebPOS). */
  remoteKitchenDone: number;
  /** Reservation alert tickets printed. */
  reservationDone: number;
};

let drainInFlight: Promise<ProcessEscPosPrintJobsResult> | null = null;

async function ackPrintJob(jobId: string, status: 'DONE' | 'FAILED', attempts = 4) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await api.post(`/merchant/pos/print-jobs/${jobId}/ack`, { status });
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Drain ESCPOS jobs on a machine that has the Print Agent (main till).
 * Serialized: overlapping 2.5s poll ticks must not print the same job twice.
 * Backend also claims jobs as PROCESSING on fetch.
 */
export async function processPendingEscPosPrintJobs(): Promise<ProcessEscPosPrintJobsResult> {
  if (drainInFlight) return drainInFlight;
  drainInFlight = (async (): Promise<ProcessEscPosPrintJobsResult> => {
    try {
      if (!(await isPrintAgentAvailable())) return { done: 0, remoteKitchenDone: 0, reservationDone: 0 };
      const localDeviceId = webPosDeviceId();
      const res = await api.get('/merchant/pos/print-jobs/pending', {
        params: { jobType: 'ESCPOS', limit: 15 },
      });
      const jobs = (res.data?.jobs || []) as PendingJob[];
      let done = 0;
      let remoteKitchenDone = 0;
      let reservationDone = 0;
      for (const job of jobs) {
        const p = (job.payload || {}) as Partial<
          EscPosPrintJobPayload & AutoPrintOrderPayload & AutoPrintReservationPayload
        >;
        if (p.kind === 'auto_print_reservation' && p.reservationId) {
          try {
            await processAutoPrintReservationJob(p as AutoPrintReservationPayload);
            await ackPrintJob(job.id, 'DONE');
            done += 1;
            reservationDone += 1;
          } catch {
            await ackPrintJob(job.id, 'FAILED').catch(() => {});
          }
          continue;
        }
        if (p.kind === 'auto_print_order' && p.orderId) {
          try {
            await processAutoPrintOrderJob(p as AutoPrintOrderPayload);
            await ackPrintJob(job.id, 'DONE');
            done += 1;
          } catch {
            await ackPrintJob(job.id, 'FAILED').catch(() => {});
          }
          continue;
        }
        if (p.kind !== 'escpos' || !p.dataBase64) {
          await ackPrintJob(job.id, 'FAILED').catch(() => {});
          continue;
        }
        try {
          await printViaAgent({
            printerName: p.printerName,
            dataBase64: p.dataBase64,
            text: p.text,
          });
          // Never mark FAILED after a successful physical print — retry DONE ack.
          await ackPrintJob(job.id, 'DONE');
          done += 1;
          const remote =
            !!job.sourceDeviceId &&
            job.sourceDeviceId !== localDeviceId &&
            p.kind === 'escpos';
          if (remote) remoteKitchenDone += 1;
        } catch (e) {
          enqueueFailedPrintJob({
            kind: 'other',
            label: String((job as { orderId?: string }).orderId || p.printerName || 'Print job'),
            dataBase64: p.dataBase64,
            printerName: p.printerName,
            text: p.text,
            error: e,
          });
          await ackPrintJob(job.id, 'FAILED').catch(() => {});
        }
      }
      return { done, remoteKitchenDone, reservationDone };
    } finally {
      drainInFlight = null;
    }
  })();
  return drainInFlight;
}
