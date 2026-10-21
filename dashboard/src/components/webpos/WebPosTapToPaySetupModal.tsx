import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { isAndroidWebPosTill } from '@/lib/print-agent';
import TapToPayWizard, {
  markWebPosTapToPaySetupDone,
  readWebPosTapToPaySetupDone,
} from '@/components/webpos/TapToPayWizard';

export { WEBPOS_TAP_TO_PAY_SETUP_KEY, markWebPosTapToPaySetupDone, readWebPosTapToPaySetupDone };

type Props = {
  open: boolean;
  adyenReady: boolean;
  tapToPayEnabled: boolean;
  onClose: () => void;
  onActivated?: () => void;
};

export default function WebPosTapToPaySetupModal({
  open,
  adyenReady,
  tapToPayEnabled,
  onClose,
  onActivated,
}: Props) {
  const { t } = useI18n();

  if (!open || !isAndroidWebPosTill()) return null;

  const finish = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-2 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-2xl dark:border-teal-900 dark:bg-stone-900"
      >
        <div className="flex items-center justify-end border-b border-stone-100 px-3 py-2 dark:border-stone-800">
          <button
            type="button"
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label={t('close')}
            onClick={finish}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <TapToPayWizard
            adyenReady={adyenReady}
            tapToPayEnabled={tapToPayEnabled}
            onActivated={onActivated}
          />
        </div>
        <div className="border-t border-stone-100 p-3 dark:border-stone-800">
          <button
            type="button"
            className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"
            onClick={finish}
          >
            {t('webPosTapToPaySetupLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
