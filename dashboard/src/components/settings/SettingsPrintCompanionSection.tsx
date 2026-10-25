import { Download, RefreshCw, Smartphone } from 'lucide-react';
import PrintCompanionVersionStatus from '@/components/settings/PrintCompanionVersionStatus';
import { useI18n } from '@/lib/i18n';
import { isDesktopApp } from '@/lib/platform';
import {
  isAndroidDevice,
  isBridgeAlreadyInstalled,
  openPrintBridgeApkInstall,
  preferredPrintCompanion,
  printAgentDownloadUrl,
  printBridgeDownloadUrl,
  type DownloadManifest,
} from '@/lib/print-agent-platform';
import { settingsDash, SettingsReportCard } from '@/components/settings/SettingsReportUi';

type Props = {
  printBridgeManifest: DownloadManifest | null;
  printAgentManifest: DownloadManifest | null;
  printAgentOk: boolean;
  printAgentHealthChecked: boolean;
  installedPrintCompanionVersion: string | null;
  printAgentOutdated: boolean;
  desktopBundledSidecarOk: boolean;
  onRefresh: () => void;
  refreshing: boolean;
};

export default function SettingsPrintCompanionSection({
  printBridgeManifest,
  printAgentManifest,
  printAgentOk,
  printAgentHealthChecked,
  installedPrintCompanionVersion,
  printAgentOutdated,
  desktopBundledSidecarOk,
  onRefresh,
  refreshing,
}: Props) {
  const { t } = useI18n();
  const bridgeUrl = printBridgeManifest?.downloadUrl || printBridgeDownloadUrl();
  const agentUrl = printAgentManifest?.downloadUrl || printAgentDownloadUrl();
  const showWindowsAgent =
    preferredPrintCompanion() !== 'android-bridge' && !(isDesktopApp() && desktopBundledSidecarOk);
  const showBridge = preferredPrintCompanion() !== 'windows-agent';
  const bridgeInstalled = isBridgeAlreadyInstalled(printAgentOk, installedPrintCompanionVersion);

  return (
    <SettingsReportCard
      id="print-bridge-download"
      icon={Smartphone}
      accent={settingsDash.info}
      title={t('kioskPrintBridgeTitle')}
      description={t('printBridgeDownloadHint')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2 text-sm"
          onClick={() => onRefresh()}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {t('webPosRefreshPrinters')}
        </button>
      </div>

      {showBridge ? (
        <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
          <PrintCompanionVersionStatus
            kind="android-bridge"
            installedVersion={installedPrintCompanionVersion}
            serverVersion={printBridgeManifest?.version}
            downloadUrl={bridgeUrl}
            onAndroid={isAndroidDevice()}
            agentChecked={printAgentHealthChecked}
            agentOk={printAgentOk}
            versionMismatch={printBridgeManifest?.versionMismatch}
            declaredVersion={printBridgeManifest?.declaredVersion}
          />
          {bridgeInstalled && installedPrintCompanionVersion ? (
            <p className="m-0 text-sm text-emerald-800 dark:text-emerald-200">
              {t('printBridgeAlreadyInstalled').replace('{version}', installedPrintCompanionVersion)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {isAndroidDevice() ? (
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2 text-sm"
                onClick={() => openPrintBridgeApkInstall(bridgeUrl)}
              >
                <Download size={14} />
                {bridgeInstalled ? t('installPrintBridgeUpdate') : t('installPrintBridge')}
              </button>
            ) : null}
            <a
              className="btn-secondary inline-flex items-center gap-2 text-sm"
              href={bridgeUrl}
              download={isAndroidDevice() ? undefined : 'reborn-print-bridge.apk'}
            >
              <Download size={14} />
              {t('downloadPrintBridge')}
              {printBridgeManifest?.version ? ` (v${printBridgeManifest.version})` : ''}
            </a>
          </div>
        </div>
      ) : null}

      {showWindowsAgent ? (
        <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] p-3">
          <PrintCompanionVersionStatus
            kind="windows-agent"
            installedVersion={installedPrintCompanionVersion}
            serverVersion={printAgentManifest?.version}
            downloadUrl={agentUrl}
            agentChecked={printAgentHealthChecked}
            agentOk={printAgentOk && !printAgentOutdated}
          />
          <a
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            href={agentUrl}
            download="reborn-print-agent-setup.exe"
          >
            <Download size={14} />
            {t('downloadPrintAgent')}
            {printAgentManifest?.version ? ` (v${printAgentManifest.version})` : ''}
          </a>
        </div>
      ) : null}
    </SettingsReportCard>
  );
}
