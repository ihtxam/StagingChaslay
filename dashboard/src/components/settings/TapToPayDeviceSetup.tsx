import { useState } from 'react';
import { Nfc } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { isAndroidWebPosTill } from '@/lib/print-agent';
import TapToPayWizard from '@/components/webpos/TapToPayWizard';

type Props = {
  adyenReady: boolean;
  tapToPayEnabled: boolean;
};

export default function TapToPayDeviceSetup({ adyenReady, tapToPayEnabled }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (!isAndroidWebPosTill()) return null;

  return (
    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/80 p-3 dark:border-teal-900 dark:bg-teal-950/30">
      <p className="text-sm font-medium text-teal-900 dark:text-teal-100">
        {t('tapToPayDeviceSetupTitle')}
      </p>
      <p className="mt-1 text-xs text-teal-800/90 dark:text-teal-200/80">
        {t('tapToPayDeviceSetupHint')}
      </p>
      {!expanded ? (
        <button
          type="button"
          className="btn btn-primary mt-3 inline-flex items-center gap-2 text-sm"
          onClick={() => setExpanded(true)}
        >
          <Nfc className="h-4 w-4" />
          {t('tapToPayWizardOpen')}
        </button>
      ) : (
        <div className="mt-3 rounded-lg border border-teal-100 bg-white/90 p-3 dark:border-teal-900 dark:bg-stone-950/50">
          <TapToPayWizard
            compact
            adyenReady={adyenReady}
            tapToPayEnabled={tapToPayEnabled}
          />
        </div>
      )}
    </div>
  );
}
