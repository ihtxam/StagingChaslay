import { ScrollText, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ReceiptDesignFields from '@/components/settings/ReceiptDesignFields';
import ReceiptThermalPreview from '@/components/settings/ReceiptThermalPreview';
import { normalizeClientReceiptHeaderPrintSettings } from '@/lib/webpos-receipt';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import { normalizeReceiptTemplateName } from '@/lib/receipt-template';

type MerchantSlice = {
  name?: string;
  businessName?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  shopLogoUrl?: string | null;
  posPrintSettings?: PosPrintSettingsClient | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  merchant: MerchantSlice | null;
  printSettings: PosPrintSettingsClient | null;
  onSaved: (next: PosPrintSettingsClient) => void;
};

export default function WebPosReceiptSettingsDrawer({
  open,
  onClose,
  merchant,
  printSettings,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PosPrintSettingsClient>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      normalizeClientReceiptHeaderPrintSettings({
        receiptTemplateName: 'Default',
        ...(printSettings || {}),
      })
    );
  }, [open, printSettings]);

  const previewSettings = useMemo(
    () => ({
      businessName: merchant?.name || merchant?.businessName || '',
      address: merchant?.address,
      city: merchant?.city,
      phone: merchant?.phone,
      vatNumber: merchant?.vatNumber,
      posPrintSettings: draft,
    }),
    [merchant, draft]
  );

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    try {
      const payload = normalizeClientReceiptHeaderPrintSettings({
        ...(printSettings || {}),
        ...draft,
        receiptTemplateName: normalizeReceiptTemplateName(draft.receiptTemplateName),
      });
      await api.put('/merchant/settings', { posPrintSettings: payload });
      onSaved(payload);
      toast.success(t('saved'));
      onClose();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg || t('failedSaveReceipt'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/40" role="dialog" aria-modal>
      <button type="button" className="h-full flex-1" aria-label={t('close')} onClick={onClose} />
      <aside className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-stone-900">
            <ScrollText size={18} className="text-teal-600" aria-hidden />
            {t('webPosReceiptDesign')}
          </h2>
          <button type="button" className="rounded-lg p-2 hover:bg-stone-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
          <ReceiptDesignFields
            compact
            shopLogoUrl={merchant?.shopLogoUrl}
            posPrintSettings={draft}
            onChange={setDraft}
          />
          <ReceiptThermalPreview settings={previewSettings} />
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            disabled={saving}
            onClick={() => void save()}
          >
            <Save size={16} aria-hidden />
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </aside>
    </div>
  );
}
