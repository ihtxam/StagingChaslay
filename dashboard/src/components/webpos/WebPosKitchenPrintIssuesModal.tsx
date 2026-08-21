import { Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { repairCatalogText } from '@/lib/text-encoding';
import { shortPrintErrorMessage } from '@/lib/webpos-print-toast';
import type { PendingPrintJob } from '@/lib/webpos-print-queue';
import type { CartLine } from './types';

type Props = {
  open: boolean;
  jobs: PendingPrintJob[];
  lines: CartLine[];
  busy?: boolean;
  money: (n: number) => string;
  onClose: () => void;
  onRetryJobs: (jobIds: string[]) => void | Promise<void>;
  onDismissJobs: (jobIds: string[]) => void;
  onRetryLine: (line: CartLine) => void | Promise<void>;
  onRetryAll: () => void | Promise<void>;
};

function kindLabel(kind: PendingPrintJob['kind'], t: (k: string) => string): string {
  if (kind === 'kitchen') return t('webPosPrintJobKitchen');
  if (kind === 'receipt') return t('webPosPrintJobReceipt');
  if (kind === 'eod') return t('webPosPrintJobEod');
  return t('webPosPrintJobOther');
}

export default function WebPosKitchenPrintIssuesModal({
  open,
  jobs,
  lines,
  busy = false,
  money,
  onClose,
  onRetryJobs,
  onDismissJobs,
  onRetryLine,
  onRetryAll,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const jobIds = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const queuedLineIds = useMemo(
    () => new Set(jobs.flatMap((j) => j.lineIds || [])),
    [jobs]
  );
  const extraLines = useMemo(
    () => lines.filter((l) => !queuedLineIds.has(l.lineId)),
    [lines, queuedLineIds]
  );

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(jobIds));
  }, [open, jobIds.join('|')]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = jobIds.filter((id) => selected.has(id));

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col rounded-2xl border border-amber-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-amber-950">{t('webPosKitchenPrintIssuesTitle')}</h2>
            <p className="mt-0.5 text-xs text-amber-800">{t('webPosKitchenPrintIssuesHint')}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-amber-700 hover:bg-amber-100"
            onClick={onClose}
            disabled={busy}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
                checked={selected.has(job.id)}
                onChange={() => toggle(job.id)}
                disabled={busy}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  {kindLabel(job.kind, t)}
                </p>
                <p className="truncate text-sm font-semibold text-stone-800">{job.label}</p>
                <p className="mt-0.5 text-xs font-medium text-rose-700">
                  {t('webPosPrintNotPrinted')}
                  {job.lastError
                    ? ` — ${shortPrintErrorMessage(job.lastError, t, 'webPosPrinterNotFoundGeneric')}`
                    : ''}
                </p>
                {job.attempts > 1 ? (
                  <p className="text-[11px] text-stone-500">
                    {t('webPosPrintRetryCount').replace('{n}', String(job.attempts))}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRetryJobs([job.id])}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                <Printer size={14} />
                {t('webPosPrint')}
              </button>
            </li>
          ))}
          {extraLines.map((line) => (
            <li
              key={line.lineId}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  {t('webPosPrintJobKitchen')}
                </p>
                <p className="truncate text-sm font-semibold text-stone-800">
                  {repairCatalogText(line.name || '')}
                </p>
                <p className="text-xs text-stone-500">
                  ×{line.quantity} · {money(line.lineTotal)}
                </p>
                <p className="mt-0.5 text-xs font-medium text-rose-700">{t('webPosPrintNotPrinted')}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRetryLine(line)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                <Printer size={14} />
                {t('webPosPrint')}
              </button>
            </li>
          ))}
          {!jobs.length && !extraLines.length ? (
            <li className="py-6 text-center text-sm text-stone-400">{t('webPosPrintIssuesEmpty')}</li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-stone-100 p-4">
          <button
            type="button"
            disabled={busy || !selectedIds.length}
            onClick={() => void onRetryJobs(selectedIds)}
            className="webpos-accent-btn flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40"
          >
            <Printer size={16} />
            {t('webPosPrintRetrySelected')}
          </button>
          <button
            type="button"
            disabled={busy || (!jobs.length && !extraLines.length)}
            onClick={() => void onRetryAll()}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-40"
          >
            {t('webPosKitchenPrintRetryAll')}
          </button>
          {selectedIds.length ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDismissJobs(selectedIds)}
              className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              {t('webPosPrintDismissSelected')}
            </button>
          ) : (
            <button
              type="button"
              className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              onClick={onClose}
              disabled={busy}
            >
              {t('close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
