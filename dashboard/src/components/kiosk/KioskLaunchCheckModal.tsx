import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Printer, XCircle } from 'lucide-react';
import {
  runKioskConnectionChecks,
  type CheckStatus,
  type ConnectionCheckResult,
} from '@/lib/kiosk-connection-check';

type Props = {
  open: boolean;
  kioskUrl: string;
  mode: 'merchant' | 'token';
  token?: string;
  cardPaymentEnabled?: boolean;
  onClose: () => void;
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
  icon: typeof CreditCard;
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

export default function KioskLaunchCheckModal({
  open,
  kioskUrl,
  mode,
  token,
  cardPaymentEnabled,
  onClose,
}: Props) {
  const [terminal, setTerminal] = useState<ConnectionCheckResult>({
    status: 'pending',
    message: 'Waiting…',
  });
  const [printer, setPrinter] = useState<ConnectionCheckResult>({
    status: 'pending',
    message: 'Waiting…',
  });
  const [ready, setReady] = useState(false);
  const [launchCountdown, setLaunchCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const launchedRef = useRef(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setLaunchCountdown(null);
    launchedRef.current = false;
    setTerminal({ status: 'checking', message: 'Checking payment terminal…' });
    setPrinter({ status: 'checking', message: 'Checking Print Bridge…' });
    setReady(false);

    const report = await runKioskConnectionChecks({
      mode,
      token,
      cardPaymentEnabled,
    });
    setTerminal(report.terminal);
    setPrinter(report.printer);
    setReady(report.ready);
    setRunning(false);
    return report.ready;
  }, [mode, token, cardPaymentEnabled]);

  useEffect(() => {
    if (!open) {
      setLaunchCountdown(null);
      launchedRef.current = false;
      return;
    }
    void (async () => {
      const ok = await runChecks();
      if (ok) setLaunchCountdown(2);
    })();
  }, [open, runChecks]);

  useEffect(() => {
    if (launchCountdown == null || !open) return;
    if (launchCountdown <= 0) {
      if (!launchedRef.current) {
        launchedRef.current = true;
        window.location.href = kioskUrl;
      }
      return;
    }
    const t = window.setTimeout(() => setLaunchCountdown((n) => (n == null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [launchCountdown, open, kioskUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-stone-50 p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="kiosk-launch-check-title"
      >
        <h2 id="kiosk-launch-check-title" className="text-xl font-bold text-stone-900">
          {running ? 'Checking connections…' : ready ? 'Ready to launch' : 'Connection check'}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Verifying payment terminal and printer before opening customer mode.
        </p>

        <div className="mt-5 space-y-3">
          <CheckRow icon={CreditCard} title="Payment terminal" result={terminal} />
          <CheckRow icon={Printer} title="Print Bridge / printer" result={printer} />
        </div>

        {ready && launchCountdown != null ? (
          <p className="mt-5 text-center text-sm font-medium text-emerald-700">
            Launching kiosk in {launchCountdown}s…
          </p>
        ) : null}

        {!running && !ready ? (
          <p className="mt-4 text-center text-sm text-red-700">
            Fix the issues above, then retry or launch anyway.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          {!running ? (
            <>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => void runChecks().then((ok) => ok && setLaunchCountdown(2))}
              >
                Retry
              </button>
              {!ready ? (
                <button
                  type="button"
                  className="btn-primary flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={() => {
                    window.location.href = kioskUrl;
                  }}
                >
                  Launch anyway
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
