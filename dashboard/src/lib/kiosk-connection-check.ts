import api from '@/lib/api';
import { getPrintAgentHealth } from '@/lib/print-agent';
import { fetchKioskDiagnosticsByToken, type KioskDiagnostics } from '@/lib/kiosk-api';

export type CheckStatus = 'pending' | 'checking' | 'ok' | 'warn' | 'error' | 'skipped';

export type ConnectionCheckResult = {
  status: CheckStatus;
  message: string;
};

export type KioskConnectionReport = {
  terminal: ConnectionCheckResult;
  printer: ConnectionCheckResult;
  /** All required checks passed — safe to auto-launch */
  ready: boolean;
  serverDiag: KioskDiagnostics | null;
};

function terminalOk(diag: KioskDiagnostics | null): boolean {
  return !!(diag?.terminalConfigured && diag?.terminalRegistered && diag?.adyenConfigured);
}

function terminalMessage(diag: KioskDiagnostics | null): string {
  if (!diag?.terminalConfigured) return 'No terminal ID configured in kiosk settings';
  if (!diag.terminalRegistered) return 'Terminal ID not found — check Settings → Payments';
  if (!diag.adyenConfigured) return 'Adyen credentials missing on merchant account';
  return `Connected — ${diag.terminalLabel || 'terminal registered'}`;
}

async function fetchServerDiagnostics(
  mode: 'merchant' | 'token',
  token?: string
): Promise<KioskDiagnostics | null> {
  if (mode === 'merchant') {
    const res = await api.get('/merchant/kiosk/diagnostics');
    return (res.data?.diagnostics as KioskDiagnostics) || null;
  }
  if (token) {
    return fetchKioskDiagnosticsByToken(token);
  }
  return null;
}

export async function runKioskConnectionChecks(opts: {
  mode: 'merchant' | 'token';
  token?: string;
  cardPaymentEnabled?: boolean;
}): Promise<KioskConnectionReport> {
  const cardRequired = opts.cardPaymentEnabled !== false;
  let serverDiag: KioskDiagnostics | null = null;

  let terminal: ConnectionCheckResult = {
    status: 'checking',
    message: 'Checking payment terminal…',
  };
  let printer: ConnectionCheckResult = {
    status: 'checking',
    message: 'Checking Print Bridge…',
  };

  const [diagResult, printHealth] = await Promise.all([
    fetchServerDiagnostics(opts.mode, opts.token).catch(() => null),
    getPrintAgentHealth().catch(() => ({ ok: false as const })),
  ]);

  serverDiag = diagResult;

  if (!cardRequired) {
    terminal = {
      status: 'skipped',
      message: 'Not required — card payments disabled (cash only)',
    };
  } else if (terminalOk(serverDiag)) {
    terminal = { status: 'ok', message: terminalMessage(serverDiag) };
  } else {
    terminal = { status: 'error', message: terminalMessage(serverDiag) };
  }

  if (printHealth.ok) {
    printer = {
      status: printHealth.printerReady ? 'ok' : 'warn',
      message: printHealth.printerReady
        ? `Print Bridge v${printHealth.version || '?'} — printer ready`
        : `Print Bridge v${printHealth.version || '?'} — connected, no printer assigned yet`,
    };
  } else {
    printer = {
      status: 'error',
      message: 'Print Bridge not running on this device (localhost:9101)',
    };
  }

  const printerPass = printer.status === 'ok' || printer.status === 'warn';
  const terminalPass =
    terminal.status === 'ok' || terminal.status === 'skipped';
  const ready = terminalPass && printerPass;

  return { terminal, printer, ready, serverDiag };
}
