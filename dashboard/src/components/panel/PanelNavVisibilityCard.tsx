import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  isPanelNavOptionChecked,
  parsePanelNavHidden,
  PANEL_NAV_HIDE_OPTIONS,
  togglePanelNavOption,
} from '@/lib/panel-nav-hidden';

type Props = {
  hidden: string[];
  onSaved: (hidden: string[]) => void;
};

export default function PanelNavVisibilityCard({ hidden, onSaved }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(hidden);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/merchant/settings/panel-nav', { panelNavHidden: draft });
      const next = parsePanelNavHidden(res.data?.settings?.panelNavHidden ?? draft);
      setDraft(next);
      onSaved(next);
      toast.success(t('panelNavSaved'));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{t('panelNavManage')}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('panelNavManageMerchantHint')}</p>
      </div>
      <div className="space-y-2">
        {PANEL_NAV_HIDE_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPanelNavOptionChecked(opt.key, draft)}
              disabled={saving}
              onChange={(e) => {
                setDraft(togglePanelNavOption(draft, opt.key, e.target.checked));
              }}
            />
            {t(opt.labelKey as any)}
          </label>
        ))}
      </div>
      <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void save()}>
        {saving ? t('saving') : t('save')}
      </button>
    </div>
  );
}
