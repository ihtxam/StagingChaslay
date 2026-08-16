import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { buildTableQrPayload, buildTableShopUrl, qrImageUrl } from '@/lib/qr';

type TableRow = {
  id: string;
  label: string;
};

type Props = {
  merchantSlug: string;
  tables: TableRow[];
};

export default function TableQrPrintPanel({ merchantSlug, tables }: Props) {
  const { t } = useI18n();
  const rows = useMemo(
    () =>
      tables.map((table) => {
        const payload = buildTableQrPayload(merchantSlug, table.id);
        const shopUrl = buildTableShopUrl(merchantSlug, table.id);
        return { ...table, payload, shopUrl, qrUrl: qrImageUrl(payload, 200) };
      }),
    [merchantSlug, tables]
  );

  const printAll = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const cards = rows
      .map(
        (r) => `
      <div class="card">
        <h2>${r.label}</h2>
        <img src="${r.qrUrl}" width="200" height="200" alt="QR" />
        <p class="hint">${t('tableQrScanHint')}</p>
        <p class="url">${r.shopUrl}</p>
      </div>`
      )
      .join('');
    w.document.write(`<!DOCTYPE html><html><head><title>${t('tableQrPrintTitle')}</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 16px; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; }
        .card { border: 1px solid #ccc; border-radius: 8px; padding: 16px; width: 240px; text-align: center; page-break-inside: avoid; }
        h2 { margin: 0 0 8px; font-size: 22px; }
        .hint { font-size: 12px; color: #666; margin: 8px 0 4px; }
        .url { font-size: 9px; word-break: break-all; color: #888; }
      </style></head><body>
      <h1>${t('tableQrPrintTitle')}</h1>
      <div class="grid">${cards}</div>
      <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`);
    w.document.close();
  };

  if (!tables.length) return null;

  return (
    <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-stone-900">{t('tableQrTitle')}</p>
          <p className="text-xs text-stone-500">{t('tableQrHint')}</p>
        </div>
        <button
          type="button"
          onClick={printAll}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Printer className="h-4 w-4" />
          {t('tableQrPrintAll')}
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {rows.slice(0, 6).map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-2 text-center">
            <p className="text-sm font-semibold">{r.label}</p>
            <img src={r.qrUrl} alt="" className="mx-auto h-24 w-24" />
          </div>
        ))}
        {rows.length > 6 && (
          <p className="self-center text-xs text-stone-500">
            +{rows.length - 6} {t('more')}
          </p>
        )}
      </div>
    </div>
  );
}
