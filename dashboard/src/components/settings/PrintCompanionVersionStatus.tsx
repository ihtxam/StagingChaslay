import { useI18n } from '@/lib/i18n';
import {
  resolvePrintCompanionInstallStatus,
  type PrintCompanionInstallStatus,
  type PrintCompanionKind,
  isAndroidDevice,
  openPrintBridgeApkInstall,
} from '@/lib/print-agent-platform';

type Props = {
  kind: PrintCompanionKind;
  installedVersion?: string | null;
  serverVersion?: string | null;
  downloadUrl?: string | null;
  className?: string;
  onAndroid?: boolean;
  agentChecked?: boolean;
};

function statusClassName(status: PrintCompanionInstallStatus): string {
  switch (status.state) {
    case 'update_available':
      return 'text-amber-800 dark:text-amber-200';
    case 'up_to_date':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'not_responding':
      return 'text-amber-800 dark:text-amber-200';
    default:
      return 'text-[var(--text-muted)]';
  }
}

export default function PrintCompanionVersionStatus({
  kind,
  installedVersion,
  serverVersion,
  downloadUrl,
  className = '',
  onAndroid = false,
  agentChecked = false,
}: Props) {
  const { t } = useI18n();
  const status = resolvePrintCompanionInstallStatus(kind, installedVersion, serverVersion, {
    onAndroid,
    agentChecked,
  });
  const label =
    kind === 'windows-agent' ? t('printAgentVersionStatusLabel') : t('printBridgeVersionStatusLabel');

  let message: string;
  switch (status.state) {
    case 'not_responding':
      message = t('printBridgeNotResponding');
      break;
    case 'not_installed':
      message =
        kind === 'windows-agent'
          ? t('printAgentNotDetected')
          : t('printBridgeNotInstalled');
      break;
    case 'update_available':
      message = t('printCompanionUpdateAvailable', {
        latest: status.latest,
        installed: status.installed,
      });
      break;
    case 'up_to_date':
      message = t('printCompanionUpToDate', { version: status.installed });
      break;
  }

  return (
    <div className={`text-sm max-w-xl ${statusClassName(status)} ${className}`.trim()}>
      <p className="m-0">
        <span className="font-medium">{label}: </span>
        {message}
      </p>
      {status.state === 'update_available' && downloadUrl ? (
        isAndroidDevice() && kind === 'android-bridge' ? (
          <button
            type="button"
            className="mt-1 inline-flex text-sm font-medium text-teal-700 underline hover:text-teal-900"
            onClick={() => openPrintBridgeApkInstall(downloadUrl)}
          >
            {t('installPrintBridgeUpdate')}
          </button>
        ) : (
          <a
            className="mt-1 inline-flex text-sm font-medium text-teal-700 underline hover:text-teal-900"
            href={downloadUrl}
            download={kind === 'android-bridge' ? undefined : 'reborn-print-agent-setup.exe'}
          >
            {kind === 'android-bridge' ? t('downloadPrintBridge') : t('downloadPrintAgent')}
          </a>
        )
      ) : null}
    </div>
  );
}
