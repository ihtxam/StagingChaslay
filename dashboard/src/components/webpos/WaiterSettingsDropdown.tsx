import { Menu, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  autoPrintKitchen: boolean;
  onAutoPrintKitchenChange: (v: boolean) => void;
};

export default function WaiterSettingsDropdown({
  open,
  onToggle,
  onClose,
  autoPrintKitchen,
  onAutoPrintKitchenChange,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 px-2.5 py-2 text-sm sm:gap-2 sm:px-3"
        aria-expanded={open}
        aria-label={t('webPosMoreShort')}
        onClick={onToggle}
      >
        <Menu className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t('webPosMoreShort')}</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('close')}
            className="fixed inset-0 z-[60] cursor-default border-0 bg-black/40 p-0"
            onClick={onClose}
          />
          <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[61] overflow-hidden rounded-xl border border-stone-700 bg-stone-900 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+6px)] sm:w-[min(18rem,calc(100vw-2rem))]">
            <div className="flex items-center justify-between border-b border-stone-800 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {t('webPosPrinting')}
              </p>
              <button
                type="button"
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800"
                onClick={onClose}
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={autoPrintKitchen}
                  onChange={(e) => onAutoPrintKitchenChange(e.target.checked)}
                />
                {t('autoPrintKitchen')}
              </label>
              <p className="text-[11px] leading-snug text-stone-500">
                {t('webPosAutoPrintKitchenHintRemote')}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
