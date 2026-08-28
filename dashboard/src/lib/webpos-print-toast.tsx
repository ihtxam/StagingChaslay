import toast from 'react-hot-toast';
import { useState } from 'react';
import {
  collectPrintErrorText,
  extractPrinterNameFromError,
  isNoisyPrintAgentDump,
  isPrinterDisconnectedError,
} from '@/lib/print-agent';

export { isPrinterDisconnectedError };

export function shortPrintErrorMessage(
  raw: unknown,
  t: (key: string) => string,
  fallbackKey = 'webPosPrintFailed'
): string {
  const msg = collectPrintErrorText(raw);
  if (!msg) return t(fallbackKey);
  const lower = msg.toLowerCase();
  if (
    /print agent offline|agent offline|start chaslay|127\.0\.0\.1:9101|econnrefused|failed to fetch|networkerror/i.test(
      lower
    )
  ) {
    return t('webPosPrintAgentOfflineShort');
  }
  if (/network required|need network|offline —|no internet/i.test(lower)) {
    return t('webPosOfflineNeedNetwork');
  }
  if (/onenote|pdf|xps|unsuitable|esc-pos|virtual|corrupted printer/i.test(lower)) {
    return t('webPosPrintPrinterIssueShort');
  }
  if (isPrinterDisconnectedError(msg)) {
    const name = extractPrinterNameFromError(msg);
    return name
      ? t('webPosPrinterNotFound').replace('{name}', name)
      : t('webPosPrinterNotFoundGeneric');
  }
  if (/COM COM\d+:/i.test(msg) || /spooler:/i.test(msg)) {
    return msg.length > 180 ? `${msg.slice(0, 177)}…` : msg;
  }
  if (isNoisyPrintAgentDump(msg)) {
    const name = extractPrinterNameFromError(msg);
    return name
      ? t('webPosPrinterNotFound').replace('{name}', name)
      : t(fallbackKey);
  }
  // Never slice a command line into a "short" toast (that leaked `Command failed: powershell…`).
  if (msg.length > 100) return t(fallbackKey);
  return msg;
}

function fullPrintErrorDetail(raw: unknown): string {
  const msg = collectPrintErrorText(raw);
  if (!msg || isNoisyPrintAgentDump(msg)) return '';
  return msg;
}

function PrintErrorToastBody({
  shortMsg,
  details,
  toastId,
  detailsLabel,
}: {
  shortMsg: string;
  details: string;
  toastId: string;
  detailsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`relative pointer-events-auto max-w-[min(92vw,22rem)] rounded-xl border px-3 py-2.5 pr-8 shadow-lg ${
        open ? 'border-red-300 bg-red-50' : 'border-red-200 bg-white'
      }`}
    >
      <p className="text-sm font-semibold leading-snug text-red-800">{shortMsg}</p>
      {details && details !== shortMsg ? (
        <button
          type="button"
          className="mt-1 text-xs font-semibold text-red-600 underline decoration-red-300 hover:text-red-800"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▲' : '▼'} {detailsLabel}
        </button>
      ) : null}
      {open && details ? (
        <p className="mt-1 max-h-24 overflow-y-auto text-[11px] leading-snug text-red-700">{details}</p>
      ) : null}
      <button
        type="button"
        className="absolute right-1 top-1 rounded p-1 text-red-400 hover:bg-red-100 hover:text-red-700"
        aria-label="Dismiss"
        onClick={() => toast.dismiss(toastId)}
      >
        ×
      </button>
    </div>
  );
}

/** Compact WebPOS print error — optional expandable details for long agent messages. */
export function toastPrintError(
  raw: unknown,
  t: (key: string) => string,
  fallbackKey = 'webPosPrintFailed'
) {
  const shortMsg = shortPrintErrorMessage(raw, t, fallbackKey);
  const details = fullPrintErrorDetail(raw);
  if (!details || details === shortMsg) {
    toast.error(shortMsg, { duration: 4500 });
    return;
  }
  toast.custom(
    (toastObj) => (
      <PrintErrorToastBody
        shortMsg={shortMsg}
        details={details}
        toastId={toastObj.id}
        detailsLabel={t('webPosPrintDetails')}
      />
    ),
    { duration: 8000 }
  );
}
