import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import HugeRteEditor from '@/components/editor/HugeRteEditor';
import { receiptHeaderContentToPlainText, receiptHeaderHtmlForEditor } from '@/lib/receipt-header-html';
import { RECEIPT_TEMPLATE_NAMES } from '@/lib/receipt-template';
import {
  RECEIPT_HEADER_PX_CHOICES,
  RECEIPT_LOGO_WIDTH_PX_MAX,
  clampReceiptHeaderTitlePx,
  receiptHeaderPixelSizesFromSettings,
  receiptHeaderTextScaleFromTitlePx,
  resizeImageFileForReceiptLogo,
  splitReceiptHeaderTextToLines,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';

type Props = {
  shopLogoUrl?: string | null;
  posPrintSettings: PosPrintSettingsClient;
  onChange: (next: PosPrintSettingsClient) => void;
  /** Hide receipt language / paper width (WebPOS drawer). */
  compact?: boolean;
};

export default function ReceiptDesignFields({
  shopLogoUrl,
  posPrintSettings: ps,
  onChange,
  compact = false,
}: Props) {
  const { t } = useI18n();

  const patch = (partial: Partial<PosPrintSettingsClient>) =>
    onChange({ ...ps, ...partial });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text)] mb-2">{t('receiptLogoUpload')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {(ps.receiptLogoUrl || shopLogoUrl) && (
            <img
              src={ps.receiptLogoUrl || shopLogoUrl || ''}
              alt=""
              className="max-h-20 w-auto rounded border border-[var(--border)] bg-white object-contain p-1"
              style={{
                maxWidth: Math.min(200, ps.receiptLogoWidthPx ?? 200),
              }}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer inline-flex text-sm">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const resized = await resizeImageFileForReceiptLogo(
                      file,
                      RECEIPT_LOGO_WIDTH_PX_MAX
                    );
                    const fd = new FormData();
                    fd.append('file', resized);
                    const res = await api.post('/merchant/media', fd);
                    const url = res.data.url as string;
                    patch({ receiptLogoUrl: url });
                    toast.success(t('saved'));
                  } catch (err: unknown) {
                    const msg =
                      err &&
                      typeof err === 'object' &&
                      'response' in err &&
                      (err as { response?: { data?: { error?: string } } }).response?.data?.error;
                    toast.error(msg || t('uploadFailed'));
                  }
                }}
              />
              {t('receiptLogoUpload')}
            </label>
            {ps.receiptLogoUrl ? (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => patch({ receiptLogoUrl: null })}
              >
                {t('receiptLogoRemove')}
              </button>
            ) : null}
          </div>
        </div>
        <label className="mt-2 block text-sm">
          <span className="mb-1 block font-medium text-[var(--text-muted)]">{t('receiptLogoWidth')}</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={48}
              max={200}
              className="input w-28"
              value={ps.receiptLogoWidthPx ?? 200}
              onChange={(e) => {
                const n = Math.min(200, Math.max(48, Number(e.target.value) || 200));
                patch({ receiptLogoWidthPx: n });
              }}
            />
            <span className="text-sm text-[var(--muted-fg)]">px</span>
          </div>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('receiptHeader')}</span>
        <HugeRteEditor
          variant="compact"
          minHeight={compact ? 120 : 160}
          placeholder={t('receiptHeaderEmptyUsesShopDetails')}
          value={receiptHeaderHtmlForEditor(ps.receiptHeader) || ps.receiptHeader || ''}
          onChange={(html) => {
            const plain = receiptHeaderContentToPlainText(html).trim();
            patch({
              receiptHeaderTitle: '',
              receiptHeader: plain ? html : '',
              receiptHeaderLines: plain ? splitReceiptHeaderTextToLines(html) : [],
            });
          }}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('receiptFooter')}</span>
        <textarea
          className="input min-h-[4rem] w-full"
          value={ps.receiptFooter || ''}
          onChange={(e) => patch({ receiptFooter: e.target.value })}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('receiptTemplate')}</span>
        <select
          className="input max-w-xs"
          value={ps.receiptTemplateName || 'Default'}
          onChange={(e) => patch({ receiptTemplateName: e.target.value })}
        >
          {RECEIPT_TEMPLATE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name === 'Default' ? t('receiptTemplateDefault') : name}
            </option>
          ))}
        </select>
      </label>

      <p className="text-sm font-semibold text-[var(--text)] m-0">{t('receiptDisplayOptions')}</p>
      <div className="flex flex-wrap gap-4 text-sm">
        {(
          [
            ['receiptShowVatTable', t('receiptShowVat')],
            ['receiptShowStaffLine', t('receiptShowStaff')],
            ['receiptShowQrCode', t('receiptShowQr')],
            ['receiptDeliveryDirectionsQr', t('receiptDeliveryDirectionsQr')],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={ps[key] !== false}
              onChange={(e) => patch({ [key]: e.target.checked } as Partial<PosPrintSettingsClient>)}
            />
            {label}
          </label>
        ))}
      </div>

      {!compact ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('receiptHeaderAlign')}</span>
            <select
              className="input max-w-xs"
              value={ps.receiptHeaderAlign || 'center'}
              onChange={(e) =>
                patch({ receiptHeaderAlign: e.target.value as 'left' | 'center' | 'right' })
              }
            >
              <option value="left">{t('receiptHeaderAlignLeft')}</option>
              <option value="center">{t('receiptHeaderAlignCenter')}</option>
              <option value="right">{t('receiptHeaderAlignRight')}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('receiptHeaderTextScale')}</span>
            <select
              className="input max-w-xs"
              value={receiptHeaderPixelSizesFromSettings(ps).titlePx}
              onChange={(e) => {
                const receiptHeaderTitlePx = clampReceiptHeaderTitlePx(e.target.value);
                const detailPx = receiptHeaderPixelSizesFromSettings(ps).detailPx;
                patch({
                  receiptHeaderTitlePx,
                  receiptHeaderDetailPx: detailPx,
                  receiptHeaderBold: true,
                  receiptHeaderTextScale: receiptHeaderTextScaleFromTitlePx(receiptHeaderTitlePx),
                });
              }}
            >
              {RECEIPT_HEADER_PX_CHOICES.map((px) => (
                <option key={px} value={px}>
                  {px} px
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}
