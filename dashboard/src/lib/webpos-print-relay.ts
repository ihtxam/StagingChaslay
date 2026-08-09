import api from '@/lib/api';
import { isPrintAgentAvailable, printViaAgent } from '@/lib/print-agent';

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
  await enqueueEscPosPrintJob(opts);
  return 'queued';
}

type PendingJob = {
  id: string;
  payload?: EscPosPrintJobPayload | Record<string, unknown> | null;
};

/** Drain ESCPOS jobs on a machine that has the Print Agent (main till). */
export async function processPendingEscPosPrintJobs(): Promise<number> {
  if (!(await isPrintAgentAvailable())) return 0;
  const res = await api.get('/merchant/pos/print-jobs/pending', {
    params: { jobType: 'ESCPOS', limit: 15 },
  });
  const jobs = (res.data?.jobs || []) as PendingJob[];
  let done = 0;
  for (const job of jobs) {
    const p = (job.payload || {}) as Partial<EscPosPrintJobPayload>;
    if (p.kind !== 'escpos' || !p.dataBase64) {
      await api.post(`/merchant/pos/print-jobs/${job.id}/ack`, { status: 'FAILED' }).catch(() => {});
      continue;
    }
    try {
      await printViaAgent({
        printerName: p.printerName,
        dataBase64: p.dataBase64,
        text: p.text,
      });
      await api.post(`/merchant/pos/print-jobs/${job.id}/ack`, { status: 'DONE' });
      done += 1;
    } catch {
      await api.post(`/merchant/pos/print-jobs/${job.id}/ack`, { status: 'FAILED' }).catch(() => {});
    }
  }
  return done;
}
