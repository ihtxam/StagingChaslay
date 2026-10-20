import type { DeviceBridgeHealth } from '@/lib/device-bridge';

function compareSemver(version: string, minimum: string): number {
  const a = String(version || '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const b = String(minimum || '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function isBridgeSemver(version: string): boolean {
  const v = String(version || '').trim();
  return !!v && compareSemver(v, '0.3.0') >= 0;
}

export type TapToPayWizardStepId =
  | 'bridgeInstall'
  | 'bridgeRunning'
  | 'panelEnabled'
  | 'register'
  | 'ready'
  | 'test';

export type TapToPayWizardStepStatus = 'ok' | 'pending' | 'warn' | 'error';

export type TapToPayWizardStep = {
  id: TapToPayWizardStepId;
  status: TapToPayWizardStepStatus;
  detail?: string;
};

export type TapToPayWizardSnapshot = {
  bridgeHealth: DeviceBridgeHealth;
  serverBridgeVersion?: string | null;
  adyenReady: boolean;
  tapToPayEnabled: boolean;
};

export function bridgeNeedsUpdate(
  installedVersion: string | undefined,
  serverVersion: string | null | undefined
): boolean {
  const installed = String(installedVersion || '').trim();
  const latest = String(serverVersion || '').trim();
  if (!installed || !latest) return false;
  if (!isBridgeSemver(installed)) return true;
  return compareSemver(installed, latest) < 0;
}

export function buildTapToPayWizardSteps(snapshot: TapToPayWizardSnapshot): TapToPayWizardStep[] {
  const { bridgeHealth, serverBridgeVersion, adyenReady, tapToPayEnabled } = snapshot;
  const bridgeOk = bridgeHealth.ok === true;
  const version = bridgeHealth.version;
  const hasSdk = bridgeHealth.hasAdyenSdk === true;
  const registered =
    bridgeHealth.tapToPayRegistered === true || bridgeHealth.tapToPayReady === true;
  const ready = bridgeOk && hasSdk && registered && bridgeHealth.tapToPayReady === true;
  const needsUpdate = bridgeNeedsUpdate(version, serverBridgeVersion);

  const installStatus: TapToPayWizardStepStatus = !bridgeOk
    ? 'pending'
    : needsUpdate
      ? 'warn'
      : hasSdk
        ? 'ok'
        : 'error';

  const runningStatus: TapToPayWizardStepStatus = bridgeOk ? 'ok' : 'error';

  let panelStatus: TapToPayWizardStepStatus = 'ok';
  if (!adyenReady && !tapToPayEnabled) panelStatus = 'error';
  else if (!adyenReady || !tapToPayEnabled) panelStatus = 'warn';

  let registerStatus: TapToPayWizardStepStatus = 'pending';
  if (!bridgeOk || !hasSdk) registerStatus = 'pending';
  else if (registered) registerStatus = 'ok';
  else if (adyenReady && tapToPayEnabled) registerStatus = 'warn';
  else registerStatus = 'pending';

  const readyStatus: TapToPayWizardStepStatus = ready ? 'ok' : registered ? 'warn' : 'pending';

  const testStatus: TapToPayWizardStepStatus = ready ? 'warn' : 'pending';

  return [
    { id: 'bridgeInstall', status: installStatus, detail: version },
    { id: 'bridgeRunning', status: runningStatus },
    { id: 'panelEnabled', status: panelStatus },
    { id: 'register', status: registerStatus },
    { id: 'ready', status: readyStatus },
    { id: 'test', status: testStatus },
  ];
}

export function tapToPayWizardComplete(steps: TapToPayWizardStep[]): boolean {
  const ready = steps.find((s) => s.id === 'ready');
  return ready?.status === 'ok';
}

/** Map raw Bridge / Adyen errors to i18n keys when possible. */
export function tapToPayErrorMessageKey(message: string | null | undefined): string | null {
  const m = String(message || '').trim();
  if (!m) return null;
  if (/AuthenticationServiceNotFound/i.test(m)) return 'tapToPayErrAuthService';
  if (/Google Play services/i.test(m)) return 'tapToPayErrPlayServices';
  if (/NFC/i.test(m) && /(off|disabled|unavailable)/i.test(m)) return 'tapToPayErrNfcOff';
  return null;
}
