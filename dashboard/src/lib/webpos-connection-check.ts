import {
  getPrintAgentHealth,
  isConfiguredPrinterMissing,
  listAgentPrinters,
  probePrintAgentHealth,
  type AgentPrinter,
} from '@/lib/print-agent';
import { probeDeviceBridgeHealth } from '@/lib/device-bridge';
import { printersForRole, type PosPrintSettingsClient } from '@/lib/webpos-receipt';

export type CheckStatus = 'pending' | 'checking' | 'ok' | 'warn' | 'error' | 'skipped';

export type ConnectionCheckResult = {
  status: CheckStatus;
  message: string;
};

export type WebPosPaymentCheckConfig = {
  methods?: {
    terminal?: boolean;
  };
  terminalReady?: boolean;
  adyenConfigured?: boolean;
  tapToPayEnabled?: boolean;
  defaultTerminalId?: string | null;
  staffPreferredTerminalId?: string | null;
  terminals?: Array<{
    terminalId: string;
    terminalName: string | null;
    status: string;
  }>;
};

export type WebPosConnectionReport = {
  agent: ConnectionCheckResult;
  receipt: ConnectionCheckResult;
  kitchen: ConnectionCheckResult;
  terminal: ConnectionCheckResult;
  tapToPay: ConnectionCheckResult;
  ready: boolean;
};

function resolveActiveTerminalId(
  terminals: WebPosPaymentCheckConfig['terminals'],
  opts: { preferred?: string | null; defaultId?: string | null }
): string {
  const active = (terminals || []).filter((t) => t.status === 'active');
  const valid = new Set(active.map((t) => t.terminalId));
  for (const candidate of [opts.preferred, opts.defaultId]) {
    const id = (candidate || '').trim();
    if (id && valid.has(id)) return id;
  }
  return active[0]?.terminalId || '';
}

function checkRolePrinters(
  role: 'receipt' | 'kitchen',
  printSettings: PosPrintSettingsClient | null,
  livePrinters: AgentPrinter[],
  agentOk: boolean
): ConnectionCheckResult {
  if (!agentOk) {
    return { status: 'error', message: 'Print Agent offline' };
  }
  const targets = printersForRole(printSettings, role);
  if (targets.length === 0) {
    return {
      status: 'warn',
      message:
        role === 'receipt'
          ? 'No receipt printer configured — check Settings → Printers'
          : 'No kitchen printer configured — check Settings → Printers',
    };
  }
  const missing = targets.filter((t) =>
    isConfiguredPrinterMissing(t.name, livePrinters, { agentOk: true, printersReady: true })
  );
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `${missing.map((m) => m.name).join(', ')} not found on this device`,
    };
  }
  return {
    status: 'ok',
    message: targets.map((t) => t.name).join(', '),
  };
}

function checkTerminal(paymentConfig?: WebPosPaymentCheckConfig | null): ConnectionCheckResult {
  const terminalEnabled = paymentConfig?.methods?.terminal === true;
  if (!terminalEnabled) {
    return { status: 'skipped', message: 'Terminal payments not enabled for this till' };
  }
  if (!paymentConfig?.adyenConfigured || !paymentConfig.terminalReady) {
    return {
      status: 'error',
      message: 'Payment terminal not configured — check Settings → Payments',
    };
  }
  const terminalId = resolveActiveTerminalId(paymentConfig.terminals, {
    preferred: paymentConfig.staffPreferredTerminalId,
    defaultId: paymentConfig.defaultTerminalId,
  });
  if (!terminalId) {
    return {
      status: 'error',
      message: 'No active payment terminal assigned — check Settings → Payments',
    };
  }
  const row = (paymentConfig.terminals || []).find((t) => t.terminalId === terminalId);
  return {
    status: 'ok',
    message: row?.terminalName?.trim() || terminalId,
  };
}

function checkTapToPay(
  paymentConfig: WebPosPaymentCheckConfig | null | undefined,
  bridge: { ok: boolean; tapToPayReady?: boolean; tapToPayMessage?: string }
): ConnectionCheckResult {
  if (paymentConfig?.tapToPayEnabled !== true) {
    return { status: 'skipped', message: 'Tap to Pay not enabled for this merchant' };
  }
  if (!paymentConfig.adyenConfigured) {
    return { status: 'error', message: 'Adyen not configured — check Settings → Payments' };
  }
  if (!bridge.ok) {
    return { status: 'error', message: 'Bridge Reborn offline — printing and Tap to Pay unavailable' };
  }
  if (bridge.tapToPayReady === true) {
    return { status: 'ok', message: 'Tap to Pay ready on this tablet' };
  }
  return {
    status: 'warn',
    message: bridge.tapToPayMessage?.trim() || 'Tap to Pay not activated on this tablet yet',
  };
}

function rolePass(r: ConnectionCheckResult): boolean {
  return r.status === 'ok' || r.status === 'warn';
}

function terminalPass(r: ConnectionCheckResult): boolean {
  return r.status === 'ok' || r.status === 'skipped';
}

function tapToPayPass(r: ConnectionCheckResult): boolean {
  return r.status === 'ok' || r.status === 'skipped' || r.status === 'warn';
}

export async function runWebPosConnectionChecks(opts: {
  printSettings: PosPrintSettingsClient | null;
  androidProbe?: boolean;
  paymentConfig?: WebPosPaymentCheckConfig | null;
}): Promise<WebPosConnectionReport> {
  const health = opts.androidProbe
    ? await probePrintAgentHealth(8).catch(() => ({ ok: false as const }))
    : await getPrintAgentHealth().catch(() => ({ ok: false as const }));

  let livePrinters: AgentPrinter[] = [];
  if (health.ok) {
    livePrinters = await listAgentPrinters().catch(() => []);
  }

  const bridge =
    opts.androidProbe && opts.paymentConfig?.tapToPayEnabled === true
      ? await probeDeviceBridgeHealth(5).catch(() => ({ ok: false as const }))
      : { ok: health.ok };

  const agentPlatform = health.platform ? ` (${health.platform})` : '';
  const agent: ConnectionCheckResult = health.ok
    ? {
        status: 'ok',
        message: opts.androidProbe
          ? `Bridge Reborn v${health.version || '?'} running${agentPlatform}`
          : `Print Agent v${health.version || '?'} running`,
      }
    : {
        status: 'error',
        message: opts.androidProbe
          ? 'Bridge Reborn not running on this tablet (localhost:9101)'
          : 'Print Agent not running on this device (localhost:9101)',
      };

  const receipt = checkRolePrinters('receipt', opts.printSettings, livePrinters, health.ok);
  const kitchen = checkRolePrinters('kitchen', opts.printSettings, livePrinters, health.ok);
  const terminal = checkTerminal(opts.paymentConfig);
  const tapToPay = checkTapToPay(opts.paymentConfig, bridge);

  const ready =
    agent.status === 'ok' &&
    rolePass(receipt) &&
    rolePass(kitchen) &&
    terminalPass(terminal) &&
    tapToPayPass(tapToPay);

  return { agent, receipt, kitchen, terminal, tapToPay, ready };
}
