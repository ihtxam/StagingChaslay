import { createPortal } from 'react-dom';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { CatalogImportProgress, CatalogImportProgressPhase } from '@/lib/catalog-import-stream';

type Props = {
  open: boolean;
  progress: CatalogImportProgress | null;
  fileName?: string;
};

const PHASE_LABEL_KEYS: Record<CatalogImportProgressPhase, string> = {
  parsing: 'importProgressParsing',
  categories: 'importProgressCategories',
  modifierGroups: 'importProgressModifiers',
  products: 'importProgressProducts',
  done: 'importProgressDone',
  error: 'importProgressError',
};

export default function ProductImportProgressModal({ open, progress, fileName }: Props) {
  const { t } = useI18n();

  if (!open) return null;

  const percent = Math.min(100, Math.max(0, Number(progress?.percent) || 0));
  const phase = progress?.phase || 'parsing';
  const phaseLabel = t(PHASE_LABEL_KEYS[phase] || 'importProgressParsing');
  const detail =
    progress?.current != null && progress?.total != null
      ? `${progress.current} / ${progress.total}`
      : progress?.message || '';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-stone-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-progress-title"
        aria-busy={phase !== 'done' && phase !== 'error'}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
            {phase === 'done' ? (
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="import-progress-title" className="text-lg font-bold">
              {t('importProgressTitle')}
            </h2>
            {fileName ? (
              <p className="mt-0.5 truncate text-sm text-stone-500 dark:text-stone-400">{fileName}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold">{phaseLabel}</span>
            <span className="tabular-nums text-stone-500">{percent}%</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          {detail ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{detail}</p>
          ) : null}
        </div>

        <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">{t('importProgressHint')}</p>
      </div>
    </div>,
    document.body
  );
}
