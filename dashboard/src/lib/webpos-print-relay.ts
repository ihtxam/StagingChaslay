import api from '@/lib/api';
import { isPrintAgentAvailable, printViaAgent } from '@/lib/print-agent';
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

/**
 * Print via local Print Agent when available; otherwise queue for the main till hub.
 * Returns `'local' | 'queued'`.
 */
export async function printViaAgentOrQueue(opts: {
  dataBase64: string;
  printerName?: string;
  text?: string;
  orderId?: string | null;
  /** Force queue even if agent looks online (tests). */
  forceQueue?: boolean;
}): Promise<'local' | 'queued'> {
  const agentReady = !opts.forceQueue && (await isPrintAgentAvailable());
  if (agentReady) {
    await printViaAgent({
      printerName: opts.printerName,
      dataBase64: opts.dataBase64,
      text: opts.text,
    });
    return 'local';
  }
  // Cloud print-job queue needs the merchant API — unavailable while offline.
  if (!isBrowserOnline()) {
    throw new Error('Print agent offline — start Chaslay Print Agent on this PC to print.');
  }
  await enqueueEscPosPrintJob(opts);
  return 'queued';
}

type PendingJob = {
  id: string;
  payload?: EscPosPrintJobPayload | Record<string, unknown> | null;
};

let drainInFlight: Promise<number> | null = null;

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
export async function processPendingEscPosPrintJobs(): Promise<number> {
  if (drainInFlight) return drainInFlight;
  drainInFlight = (async () => {
    try {
      if (!(await isPrintAgentAvailable())) return 0;
      const res = await api.get('/merchant/pos/print-jobs/pending', {
        params: { jobType: 'ESCPOS', limit: 15 },
      });
      const jobs = (res.data?.jobs || []) as PendingJob[];
      let done = 0;
      for (const job of jobs) {
        const p = (job.payload || {}) as Partial<
          EscPosPrintJobPayload & AutoPrintOrderPayload & AutoPrintReservationPayload
        >;
        if (p.kind === 'auto_print_reservation' && p.reservationId) {
          try {
            await processAutoPrintReservationJob(p as AutoPrintReservationPayload);
            await ackPrintJob(job.id, 'DONE');
            done += 1;
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
        } catch {
          await ackPrintJob(job.id, 'FAILED').catch(() => {});
        }
      }
      return done;
    } finally {
      drainInFlight = null;
    }
  })();
  return drainInFlight;
}
