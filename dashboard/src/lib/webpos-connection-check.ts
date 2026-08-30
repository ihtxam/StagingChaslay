import {
  getPrintAgentHealth,
  isConfiguredPrinterMissing,
  listAgentPrinters,
  type AgentPrinter,
} from '@/lib/print-agent';
import { printersForRole, type PosPrintSettingsClient } from '@/lib/webpos-receipt';

export type CheckStatus = 'pending' | 'checking' | 'ok' | 'warn' | 'error' | 'skipped';

export type ConnectionCheckResult = {
  status: CheckStatus;
  message: string;
};

export type WebPosConnectionReport = {
  agent: ConnectionCheckResult;
  receipt: ConnectionCheckResult;
  kitchen: ConnectionCheckResult;
  ready: boolean;
};

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
      message: `${missing.map((m) => m.name).join(', ')} not found on this PC`,
    };
  }
  return {
    status: 'ok',
    message: targets.map((t) => t.name).join(', '),
  };
}

export async function runWebPosConnectionChecks(opts: {
  printSettings: PosPrintSettingsClient | null;
}): Promise<WebPosConnectionReport> {
  const health = await getPrintAgentHealth().catch(() => ({ ok: false as const }));
  let livePrinters: AgentPrinter[] = [];
  if (health.ok) {
    livePrinters = await listAgentPrinters().catch(() => []);
  }

  const agent: ConnectionCheckResult = health.ok
    ? {
        status: 'ok',
        message: `Print Agent v${health.version || '?'} running`,
      }
    : {
        status: 'error',
        message: 'Print Agent not running on this device (localhost:9101)',
      };

  const receipt = checkRolePrinters('receipt', opts.printSettings, livePrinters, health.ok);
  const kitchen = checkRolePrinters('kitchen', opts.printSettings, livePrinters, health.ok);

  const rolePass = (r: ConnectionCheckResult) => r.status === 'ok' || r.status === 'warn';
  const ready = agent.status === 'ok' && rolePass(receipt) && rolePass(kitchen);

  return { agent, receipt, kitchen, ready };
}
