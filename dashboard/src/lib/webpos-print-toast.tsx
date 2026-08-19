import toast from 'react-hot-toast';
import { useState } from 'react';

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function extractPrintErrorText(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  const obj = raw as {
    response?: { data?: { error?: unknown } };
    message?: unknown;
    error?: unknown;
    stderr?: unknown;
  };
  return (
    asText(obj.response?.data?.error) ||
    asText(obj.error) ||
    asText(obj.message) ||
    asText(obj.stderr) ||
    String(raw || '')
  ).trim();
}

/** Full blob for detection — old agents put Win32/OpenPrinter in stderr, not message. */
function collectPrintErrorBlob(raw: unknown): string {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const nested =
    obj && typeof obj.response === 'object' && obj.response
      ? ((obj.response as { data?: { error?: unknown } }).data?.error ?? '')
      : '';
  return [
    extractPrintErrorText(raw),
    asText(obj?.stderr),
    asText(obj?.error),
    asText(nested),
  ]
    .filter(Boolean)
    .join('\n');
}

function extractPrinterName(msg: string): string {
  const m =
    msg.match(/Printer '([^']+)' not found/i) ||
    msg.match(/OpenPrinter failed for '([^']+)'/i) ||
    msg.match(/failed for '([^']+)'/i) ||
    msg.match(/\bGLPrinter\b/i);
  const name = (m?.[1] || m?.[0] || '').trim();
  return name;
}

/** True when the raw agent/PowerShell dump should stay hidden. */
function isNoisyPrintDump(msg: string): boolean {
  return /command failed|powershell\.exe|-noprofile|executionpolicy|win-raw-print|win-scale-read|categoryinfo|fullyqualifiederrorid|chaslayreborn-print-|manupos-print-|chaslayprintagent|at c:\\|\\temp\\|-\s*file\s+c:\\|\.ps1\b/i.test(
    msg
  );
}

function isPrinterMissingError(msg: string): boolean {
  return /win32\s*[=:]?\s*1801|\b1801\b|error_invalid_printer_name|not found or disconnected|openprinter failed|\bglprinter\b/i.test(
    msg
  );
}

export function shortPrintErrorMessage(
  raw: unknown,
  t: (key: string) => string,
  fallbackKey = 'webPosPrintFailed'
): string {
  const msg = extractPrintErrorText(raw);
  const blob = collectPrintErrorBlob(raw);
  if (!msg && !blob) return t(fallbackKey);
  const detect = `${msg}\n${blob}`;
  const lower = detect.toLowerCase();
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
  if (isPrinterMissingError(detect)) {
    const name = extractPrinterName(detect);
    return name
      ? t('webPosPrinterNotFound').replace('{name}', name)
      : t('webPosPrinterNotFoundGeneric');
  }
  if (isNoisyPrintDump(detect)) {
    const name = extractPrinterName(detect);
    return name
      ? t('webPosPrinterNotFound').replace('{name}', name)
      : t(fallbackKey);
  }
  // Never slice a command line into a "short" toast (that leaked `Command failed: powershell…`).
  if (msg.length > 100) return t(fallbackKey);
  return msg;
}

function fullPrintErrorDetail(raw: unknown): string {
  const msg = extractPrintErrorText(raw);
  if (!msg || isNoisyPrintDump(msg) || isNoisyPrintDump(collectPrintErrorBlob(raw))) return '';
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
