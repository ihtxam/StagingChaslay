import api from '@/lib/api';
import {
  isPrintAgentAvailable,
  printViaAgent,
  settleAfterBluetoothKitchenPrint,
  type AgentPrinter,
} from '@/lib/print-agent';
import { escposFeedAndCut, uint8ToBase64 } from '@/lib/webpos-receipt';
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
  /** Kitchen / receipt / EOD classification for relay auto-print gates. */
  jobKind?: PrintJobKind;
  /** Till bell: reservation | online_order */
  alertKind?: string;
};

const MERCHANT_AUTOPRINT_CACHE_KEY = 'manupos_merchant_autoprint_cache';

export type PosAutoPrintSettings = {
  autoPrintReceipt?: boolean;
  autoPrintKitchen?: boolean;
};

/** Merchant Settings → Receipts: master gate for customer receipt auto-print. */
export function isMerchantAutoPrintReceiptEnabled(
  printSettings?: PosAutoPrintSettings | null
): boolean {
  return printSettings?.autoPrintReceipt !== false;
}

/** Merchant Settings → Receipts: master gate for kitchen auto-print. */
export function isMerchantAutoPrintKitchenEnabled(
  printSettings?: PosAutoPrintSettings | null
): boolean {
  return printSettings?.autoPrintKitchen !== false;
}

/** Merchant Settings gate for customer receipt auto-print at checkout. */
export function shouldAutoPrintReceipt(printSettings?: PosAutoPrintSettings | null): boolean {
  return isMerchantAutoPrintReceiptEnabled(printSettings);
}

/** Merchant Settings gate for kitchen auto-print (send / checkout). */
export function shouldAutoPrintKitchen(printSettings?: PosAutoPrintSettings | null): boolean {
  return isMerchantAutoPrintKitchenEnabled(printSettings);
}

/** Cache merchant auto-print flags so relay polling matches checkout gates. */
export function cacheMerchantAutoPrintSettings(printSettings?: PosAutoPrintSettings | null): void {
  try {
    localStorage.setItem(
      MERCHANT_AUTOPRINT_CACHE_KEY,
      JSON.stringify({
        autoPrintReceipt: isMerchantAutoPrintReceiptEnabled(printSettings),
        autoPrintKitchen: isMerchantAutoPrintKitchenEnabled(printSettings),
      })
    );
  } catch {
    /* ignore */
  }
}

export function readCachedMerchantAutoPrintSettings(): PosAutoPrintSettings {
  try {
    const raw = localStorage.getItem(MERCHANT_AUTOPRINT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PosAutoPrintSettings;
    return {
      autoPrintReceipt: parsed.autoPrintReceipt !== false,
      autoPrintKitchen: parsed.autoPrintKitchen !== false,
    };
  } catch {
    return {};
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

  const agentOnline = !opts.forceQueue && (await isPrintAgentAvailable());
  const canPrintLocally =
    agentOnline && (retryLocally || isLocalPrintStation(agentOnline));
  if (canPrintLocally) {
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
      ? 'Print agent offline — start Reborn Print Agent on this PC to print.'
      : 'Network required — connect to send prints to the main till.'
  );
  if (retryLocally || !isBrowserOnline()) {
    persistLocal(offlineErr);
    throw offlineErr;
  }

  await enqueueEscPosPrintJob(opts);
  return 'queued';
}

/**
 * Kitchen print, then a tiny feed+cut job on Bluetooth/COM so the blade runs
 * even when the last packet of the ticket was dropped.
 */
export async function printKitchenViaAgentOrQueue(
  opts: Parameters<typeof printViaAgentOrQueue>[0] & {
    printers?: AgentPrinter[];
    configuredName?: string | null;
  }
): Promise<'local' | 'queued'> {
  const mode = await printViaAgentOrQueue(opts);
  try {
    await printViaAgentOrQueue({
      printerName: opts.printerName,
      dataBase64: uint8ToBase64(escposFeedAndCut()),
      orderId: opts.orderId,
      retryLocally: opts.retryLocally,
      forceQueue: opts.forceQueue,
      jobKind: 'kitchen',
      jobLabel: opts.jobLabel ? `${opts.jobLabel} · cut` : 'Kitchen cut',
    });
  } catch {
    /* ticket may already have cut; follow-up is best-effort */
  }
  const live = opts.printers?.find((p) => p.name === opts.printerName);
  await settleAfterBluetoothKitchenPrint(live || opts.printerName || opts.configuredName || '');
  return mode;
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
  const merchant = readCachedMerchantAutoPrintSettings();
  if (jobKind === 'kitchen') {
    return shouldAutoPrintKitchen(merchant);
  }
  if (jobKind === 'receipt') {
    return shouldAutoPrintReceipt(merchant);
  }
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
        const p = (job.payload || {}) as {
          kind?: string;
          dataBase64?: string;
          printerName?: string;
          text?: string;
          jobKind?: PrintJobKind;
          alertKind?: string;
          reservationId?: string;
          orderId?: string;
          printKitchen?: boolean;
          printReceipt?: boolean;
          printNotification?: boolean;
          printDeliveryReceipt?: boolean;
        };
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
          const payload = p as AutoPrintOrderPayload;
          const allowKitchen =
            payload.printKitchen === true &&
            shouldAutoPrintKitchen(readCachedMerchantAutoPrintSettings());
          const allowReceiptLike =
            (payload.printReceipt === true ||
              payload.printNotification === true ||
              payload.printDeliveryReceipt === true) &&
            shouldAutoPrintReceipt(readCachedMerchantAutoPrintSettings());
          if (!allowKitchen && !allowReceiptLike) {
            await ackPrintJob(job.id, 'DONE');
            continue;
          }
          try {
            await processAutoPrintOrderJob({
              ...payload,
              printKitchen: allowKitchen,
              printReceipt: allowReceiptLike && payload.printReceipt === true,
              printNotification: allowReceiptLike && payload.printNotification === true,
              printDeliveryReceipt: allowReceiptLike && payload.printDeliveryReceipt === true,
            });
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
          if (relayKind === 'kitchen') {
            try {
              await printViaAgent({
                printerName: p.printerName,
                dataBase64: uint8ToBase64(escposFeedAndCut()),
              });
            } catch {
              /* cut follow-up is best-effort */
            }
          }
          // Never mark FAILED after a successful physical print — retry DONE ack.
          await ackPrintJob(job.id, 'DONE');
          done += 1;
          if (p.alertKind === 'reservation') reservationDone += 1;
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
