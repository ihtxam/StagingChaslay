import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Printer, Receipt, XCircle } from 'lucide-react';
import {
  runWebPosConnectionChecks,
  type CheckStatus,
  type ConnectionCheckResult,
} from '@/lib/webpos-connection-check';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  printSettings: PosPrintSettingsClient | null;
  onContinue: () => void;
};

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'checking' || status === 'pending') {
    return <Loader2 className="h-6 w-6 shrink-0 animate-spin text-stone-400" />;
  }
  if (status === 'ok' || status === 'skipped') {
    return <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />;
  }
  if (status === 'warn') {
    return <CheckCircle2 className="h-6 w-6 shrink-0 text-amber-500" />;
  }
  return <XCircle className="h-6 w-6 shrink-0 text-red-600" />;
}

function CheckRow({
  icon: Icon,
  title,
  result,
}: {
  icon: typeof Printer;
  title: string;
  result: ConnectionCheckResult;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <StatusIcon status={result.status} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold text-stone-900">
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </p>
        <p className="mt-1 text-sm text-stone-600">{result.message}</p>
      </div>
    </div>
  );
}

export default function WebPosLaunchCheckModal({ open, printSettings, onContinue }: Props) {
  const { t } = useI18n();
  const [agent, setAgent] = useState<ConnectionCheckResult>({
    status: 'pending',
    message: 'Waiting…',
  });
  const [receipt, setReceipt] = useState<ConnectionCheckResult>({
    status: 'pending',
    message: 'Waiting…',
  });
  const [kitchen, setKitchen] = useState<ConnectionCheckResult>({
    status: 'pending',
    message: 'Waiting…',
  });
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setCountdown(null);
    setAgent({ status: 'checking', message: t('webPosLaunchCheckAgent') });
    setReceipt({ status: 'checking', message: t('webPosLaunchCheckReceipt') });
    setKitchen({ status: 'checking', message: t('webPosLaunchCheckKitchen') });
    setReady(false);

    const report = await runWebPosConnectionChecks({ printSettings });
    setAgent(report.agent);
    setReceipt(report.receipt);
    setKitchen(report.kitchen);
    setReady(report.ready);
    setRunning(false);
    return report.ready;
  }, [printSettings, t]);

  useEffect(() => {
    if (!open) {
      setCountdown(null);
      return;
    }
    void (async () => {
      const ok = await runChecks();
      if (ok) setCountdown(2);
    })();
  }, [open, runChecks]);

  useEffect(() => {
    if (countdown == null || !open) return;
    if (countdown <= 0) {
      onContinue();
      return;
    }
    const id = window.setTimeout(() => setCountdown((n) => (n == null ? null : n - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdown, open, onContinue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-stone-100 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-stone-900">{t('webPosLaunchCheckTitle')}</h2>
        <p className="mt-1 text-sm text-stone-600">{t('webPosLaunchCheckHint')}</p>

        <div className="mt-5 space-y-3">
          <CheckRow icon={Printer} title={t('webPosLaunchCheckAgentTitle')} result={agent} />
          <CheckRow icon={Receipt} title={t('webPosLaunchCheckReceiptTitle')} result={receipt} />
          <CheckRow icon={Printer} title={t('webPosLaunchCheckKitchenTitle')} result={kitchen} />
        </div>

        {ready && countdown != null ? (
          <p className="mt-5 text-center text-sm font-semibold text-emerald-700">
            {t('webPosLaunchCheckEntering').replace('{n}', String(countdown))}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary flex-1 py-2.5"
            disabled={running}
            onClick={() => void runChecks()}
          >
            {t('webPosRetry')}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-2.5"
            disabled={running}
            onClick={onContinue}
          >
            {ready ? t('webPosLaunchCheckContinue') : t('webPosLaunchCheckContinueAnyway')}
          </button>
        </div>
      </div>
    </div>
  );
}
