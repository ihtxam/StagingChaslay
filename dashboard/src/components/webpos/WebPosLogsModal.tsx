import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Send, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  buildSupportLogPayload,
  buildWebPosDiagnostics,
  clearWebPosLogs,
  formatWebPosLogsText,
  readWebPosLogs,
  type WebPosDiagnostics,
} from '@/lib/webpos-log';
import { webPosVersionLabel } from '@/lib/app-version';

type Props = {
  open: boolean;
  onClose: () => void;
  diagnostics?: Partial<WebPosDiagnostics>;
  /** When true, submit logs to support as soon as the modal opens. */
  autoSend?: boolean;
};

export default function WebPosLogsModal({ open, onClose, diagnostics, autoSend }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const autoSendStarted = useRef(false);

  const entries = useMemo(() => (open ? readWebPosLogs() : []), [open, tick]);
  const text = useMemo(() => formatWebPosLogsText(entries), [entries]);
  const fullDiagnostics = useMemo(
    () =>
      buildWebPosDiagnostics({
        appVersion: webPosVersionLabel,
        ...diagnostics,
      }),
    [diagnostics]
  );

  const sendLogs = useCallback(async () => {
    setBusy(true);
    try {
      const body = buildSupportLogPayload(entries, fullDiagnostics);
      await api.post('/merchant/support/tickets', {
        category: 'technical',
        subcategory: 'webpos',
        subject: `WebPOS logs — ${new Date().toLocaleString()}`,
        body,
      });
      toast.success(t('webPosLogsSent'));
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('webPosLogsSendFailed'));
    } finally {
      setBusy(false);
    }
  }, [entries, fullDiagnostics, onClose, t]);

  useEffect(() => {
    if (!open) {
      autoSendStarted.current = false;
      return;
    }
    if (!autoSend || autoSendStarted.current) return;
    autoSendStarted.current = true;
    void sendLogs();
  }, [open, autoSend, sendLogs]);

  if (!open) return null;

  const copyLogs = async () => {
    const payload = buildSupportLogPayload(entries, fullDiagnostics);
    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t('webPosLogsCopied'));
    } catch {
      toast.error(t('webPosLogsCopyFailed'));
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-bold text-stone-900">{t('webPosLogsTitle')}</h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label={t('close')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto bg-stone-950 p-3 text-[11px] leading-relaxed text-stone-100">
          {text || t('webPosLogsEmpty')}
        </pre>
        <div className="flex flex-wrap gap-2 border-t border-stone-100 p-3">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-xs"
            onClick={() => void copyLogs()}
          >
            <Copy size={14} />
            {t('webPosLogsCopy')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="webpos-accent-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40"
            onClick={() => void sendLogs()}
          >
            <Send size={14} />
            {busy ? t('loading') : t('webPosLogsSend')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            onClick={() => {
              clearWebPosLogs();
              setTick((n) => n + 1);
            }}
          >
            <Trash2 size={14} />
            {t('webPosLogsClear')}
          </button>
        </div>
      </div>
    </div>
  );
}
