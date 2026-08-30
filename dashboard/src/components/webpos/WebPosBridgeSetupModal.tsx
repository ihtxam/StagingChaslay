import { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw, WifiOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { AgentPrinter } from '@/lib/print-agent';
import {
  buildPrinterProfileUpdate,
  listSuitablePrinters,
  type BridgeSetupMode,
} from '@/lib/webpos-bridge-setup';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';

type Props = {
  open: boolean;
  mode: BridgeSetupMode;
  printers: AgentPrinter[];
  printerName: string;
  printSettings: PosPrintSettingsClient | null;
  checking: boolean;
  starting?: boolean;
  onRefresh: () => Promise<void>;
  onConfirm: (opts: {
    printerName: string;
    printSettings: PosPrintSettingsClient;
  }) => Promise<void>;
  onDismiss: () => void;
};

export default function WebPosBridgeSetupModal({
  open,
  mode,
  printers,
  printerName,
  printSettings,
  checking,
  starting = false,
  onRefresh,
  onConfirm,
  onDismiss,
}: Props) {
  const { t } = useI18n();
  const suitable = useMemo(() => listSuitablePrinters(printers), [printers]);
  const [selected, setSelected] = useState(printerName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'confirm_single' && suitable.length === 1) {
      setSelected(suitable[0].name);
      return;
    }
    setSelected(printerName || suitable[0]?.name || '');
  }, [open, mode, printerName, suitable]);

  if (!open) return null;

  const save = async () => {
    const name = selected.trim();
    if (!name) return;
    setSaving(true);
    try {
      const next = buildPrinterProfileUpdate(printSettings, name, {
        kitchen: true,
        receipt: true,
      });
      await onConfirm({ printerName: name, printSettings: next });
      onDismiss();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-xl"
      >
        {mode === 'bridge_offline' ? (
          <>
            <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-300">
              <WifiOff className="h-5 w-5 shrink-0" aria-hidden />
              <h2 className="text-lg font-bold text-[var(--text)]">
                {starting || checking
                  ? t('webPosBridgeSetupStartingTitle')
                  : t('webPosBridgeSetupOfflineTitle')}
              </h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {starting || checking
                ? t('webPosBridgeSetupStartingBody')
                : t('webPosBridgeSetupOfflineBody')}
            </p>
            {!starting && !checking ? (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                <li>{t('webPosBridgeSetupStepOpenApp')}</li>
                <li>{t('webPosBridgeSetupStepRunWizard')}</li>
                <li>{t('webPosBridgeSetupStepRetry')}</li>
              </ol>
            ) : null}
            <p className="mt-3 text-sm text-[var(--text-muted)]">{t('webPosBridgeSetupOfflineHint')}</p>
          </>
        ) : null}

        {mode === 'no_printers' ? (
          <>
            <div className="mb-3 flex items-center gap-2 text-[var(--text)]">
              <Printer className="h-5 w-5 shrink-0" aria-hidden />
              <h2 className="text-lg font-bold">{t('webPosBridgeSetupNoPrintersTitle')}</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{t('webPosBridgeSetupNoPrintersBody')}</p>
          </>
        ) : null}

        {mode === 'confirm_single' ? (
          <>
            <div className="mb-3 flex items-center gap-2 text-[var(--text)]">
              <Printer className="h-5 w-5 shrink-0" aria-hidden />
              <h2 className="text-lg font-bold">{t('webPosBridgeSetupSingleTitle')}</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{t('webPosBridgeSetupSingleBody')}</p>
            <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 font-semibold text-[var(--text)]">
              {selected || suitable[0]?.name}
            </p>
          </>
        ) : null}

        {mode === 'pick_printer' ? (
          <>
            <div className="mb-3 flex items-center gap-2 text-[var(--text)]">
              <Printer className="h-5 w-5 shrink-0" aria-hidden />
              <h2 className="text-lg font-bold">{t('webPosBridgeSetupPickTitle')}</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{t('webPosBridgeSetupPickBody')}</p>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-[var(--text)]">{t('printerName')}</span>
              <select
                className="input mt-1 w-full"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">{t('webPosBridgeSetupSelectPrinter')}</option>
                {suitable.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                    {p.connectionType ? ` (${p.connectionType})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {(mode === 'confirm_single' || mode === 'pick_printer') && (
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saving || !selected.trim()}
              onClick={() => void save()}
            >
              {t('webPosBridgeSetupUsePrinter')}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={checking || saving}
            onClick={() => void onRefresh()}
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden />
            {t('refresh')}
          </button>
          {(mode === 'pick_printer' || mode === 'no_printers' || mode === 'bridge_offline') && (
            <button type="button" className="btn-secondary" onClick={onDismiss}>
              {mode === 'bridge_offline' ? t('webPosBridgeSetupContinueWithoutPrint') : t('webPosBridgeSetupLater')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
