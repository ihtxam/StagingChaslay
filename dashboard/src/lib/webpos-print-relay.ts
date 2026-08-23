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

export type PrintJobKind = 'kitchen' | 'receipt' | 'eod' | 'other';

export type EscPosPrintJobPayload = {
  kind: 'escpos';
  dataBase64: string;
  printerName?: string;
  text?: string;
  /** Used by the main till to honour local auto-print toggles for relayed jobs. */
  jobKind?: PrintJobKind;
};

const AUTO_PRINT_RECEIPT_KEY = 'manupos_webpos_autoprint';
const AUTO_PRINT_KITCHEN_KEY = 'manupos_webpos_autoprint_kitchen';
const AUTO_PRINT_KITCHEN_DEVICE_KEY = 'manupos_webpos_autoprint_kitchen_device';

/** Main till: auto-print customer receipts (local sales + relayed jobs). */
export function readMainTillAutoPrintReceipt(): boolean {
  try {
    return localStorage.getItem(AUTO_PRINT_RECEIPT_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Per-device receipt auto-print (mobile / waiter WebPOS checkout). */
export function readDeviceAutoPrintReceipt(): boolean {
  return readMainTillAutoPrintReceipt();
}

export function writeDeviceAutoPrintReceipt(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_PRINT_RECEIPT_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Main till: auto-print kitchen tickets relayed from waiter phones / mobile WebPOS. */
export function readMainTillAutoPrintKitchen(): boolean {
  try {
    return localStorage.getItem(AUTO_PRINT_KITCHEN_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Per-device kitchen auto-print when sending from phone / waiter app. */
export function readDeviceAutoPrintKitchen(merchantDefault = true): boolean {
  try {
    const v = localStorage.getItem(AUTO_PRINT_KITCHEN_DEVICE_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
    return merchantDefault;
  } catch {
    return merchantDefault;
  }
}

export function writeDeviceAutoPrintKitchen(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_PRINT_KITCHEN_DEVICE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function syncMainTillAutoPrintKitchen(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_PRINT_KITCHEN_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Queue raw ESC/POS for the main till (browser with Print Agent online). */
export async function enqueueEscPosPrintJob(opts: {
  dataBase64: string;
  printerName?: string;
  text?: string;
  orderId?: string | null;
  jobKind?: PrintJobKind;
}): Promise<{ jobId: string }> {
  const payload: EscPosPrintJobPayload = {
    kind: 'escpos',
    dataBase64: opts.dataBase64,
    printerName: opts.printerName || undefined,
    text: opts.text,
    jobKind: opts.jobKind,
  };
  const res = await api.post('/merchant/pos/print-jobs', {
    jobType: 'ESCPOS',
    payload,
    sourceDeviceId: webPosDeviceId(),
    orderId: opts.orderId || null,
  });
  return { jobId: String(res.data?.jobId || '') };
}

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

function shouldPrintRelayedJob(
  job: PendingJob,
  localDeviceId: string,
  jobKind: PrintJobKind | undefined
): boolean {
  const remote = !!job.sourceDeviceId && job.sourceDeviceId !== localDeviceId;
  if (!remote) return true;
  if (jobKind === 'eod') return true;
  if (jobKind === 'kitchen') return readMainTillAutoPrintKitchen();
  if (jobKind === 'receipt') return readMainTillAutoPrintReceipt();
  return true;
}

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
          if (!readMainTillAutoPrintReceipt() && !readMainTillAutoPrintKitchen()) {
            await ackPrintJob(job.id, 'DONE');
            continue;
          }
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
        const relayKind = p.jobKind as PrintJobKind | undefined;
        if (!shouldPrintRelayedJob(job, localDeviceId, relayKind)) {
          await ackPrintJob(job.id, 'DONE');
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
            relayKind === 'kitchen';
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
