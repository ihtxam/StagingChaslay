import { Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  isPanelNavOptionChecked,
  PANEL_NAV_HIDE_OPTIONS,
  togglePanelNavOption,
} from '@/lib/panel-nav-hidden';

type Props = {
  open: boolean;
  merchantName: string;
  hidden: string[];
  saving?: boolean;
  hintKey?: 'panelNavManageHint' | 'panelNavManageMerchantHint';
  onClose: () => void;
  onChange: (hidden: string[]) => void;
  onSave: () => void;
};

export default function PanelNavManageModal({
  open,
  merchantName,
  hidden,
  saving = false,
  hintKey = 'panelNavManageHint',
  onClose,
  onChange,
  onSave,
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="shrink-0 space-y-1 border-b border-stone-200 p-5">
          <h2 className="text-lg font-bold text-stone-900">{t('panelNavManage')}</h2>
          <p className="text-sm text-stone-600">{merchantName}</p>
          <p className="text-xs text-stone-500">{t(hintKey)}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-5">
          {PANEL_NAV_HIDE_OPTIONS.map((opt) => {
            const checked = isPanelNavOptionChecked(opt.key, hidden);
            return (
              <label key={opt.key} className="flex items-center gap-2 text-sm text-stone-800">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={(e) => {
                    onChange(togglePanelNavOption(hidden, opt.key, e.target.checked));
                  }}
                />
                {t(opt.labelKey as any)}
              </label>
            );
          })}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200 p-5">
          <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary text-sm min-w-[6rem]" disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
