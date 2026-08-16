import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Download, QrCode, Save, Settings2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useTableManagement } from '@/hooks/useTableManagement';
import {
  DEFAULT_TABLE_QR_SETTINGS,
  QR_LAYOUT_TEMPLATES,
  type QrDownloadStyle,
  type QrLayoutTemplate,
  type TableQrCodeRow,
  type TableQrSettings,
} from '@/lib/table-management';
import {
  downloadQrBlob,
  mergeTableQrSettings,
  renderTableQrPng,
  tableQrDownloadFilename,
} from '@/lib/table-qr-download';
import { buildTableQrPayload, buildTableShopUrl, qrImageUrl } from '@/lib/qr';

type TableQrView = {
  id: string;
  label: string;
  capacity: number;
  sectionName: string;
  payload: string;
  shopUrl: string;
  qrUrl: string;
  codes: TableQrCodeRow[];
};

export default function TableQrCodes() {
  const { t } = useI18n();
  const { sections, allTables, merchantSlug, loading, reload } = useTableManagement();
  const [qrCodes, setQrCodes] = useState<TableQrCodeRow[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | 'all'>('all');
  const [selected, setSelected] = useState<TableQrView | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStyle, setBulkStyle] = useState<QrDownloadStyle>('medium');
  const [codeType, setCodeType] = useState<'static' | 'temporary'>('static');
  const [customCode, setCustomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrSettings, setQrSettings] = useState<TableQrSettings>(DEFAULT_TABLE_QR_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<Required<TableQrSettings>>(DEFAULT_TABLE_QR_SETTINGS);

  const loadQrCodes = useCallback(async () => {
    try {
      const res = await api.get('/merchant/floor-plans/qr-codes');
      setQrCodes(res.data.codes || []);
    } catch {
      setQrCodes([]);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/merchant/settings');
      const merged = mergeTableQrSettings(res.data?.tableQrSettings);
      setQrSettings(merged);
      setDraftSettings(merged);
    } catch {
      setQrSettings(DEFAULT_TABLE_QR_SETTINGS);
      setDraftSettings(DEFAULT_TABLE_QR_SETTINGS);
    }
  }, []);

  useEffect(() => {
    void loadQrCodes();
    void loadSettings();
  }, [loadQrCodes, loadSettings, allTables.length]);

  const sectionNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) m.set(s.id, s.name);
    return m;
  }, [sections]);

  const rows: TableQrView[] = useMemo(() => {
    if (!merchantSlug) return [];
    return allTables.map((table) => {
      const tableCodes = qrCodes.filter((c) => c.tableId === table.id);
      const staticCode = tableCodes.find((c) => c.codeType === 'static');
      const tempCode = tableCodes.find((c) => c.codeType === 'temporary');
      const defaultPayload = buildTableQrPayload(merchantSlug, table.id);
      const payload = staticCode?.code || tempCode?.code || defaultPayload;
      return {
        id: table.id,
        label: table.label,
        capacity: table.capacity,
        sectionName: sectionNameById.get(table.floorPlanId) || table.floorPlanName || '',
        payload,
        shopUrl: buildTableShopUrl(merchantSlug, table.id),
        qrUrl: qrImageUrl(payload, 200),
        codes: tableCodes,
      };
    });
  }, [allTables, merchantSlug, qrCodes, sectionNameById]);

  const filtered = useMemo(() => {
    if (activeSectionId === 'all') return rows;
    return rows.filter((r) => {
      const table = allTables.find((tbl) => tbl.id === r.id);
      return table?.floorPlanId === activeSectionId;
    });
  }, [rows, activeSectionId, allTables]);

  const openTable = (row: TableQrView) => {
    setSelected(row);
    setCustomCode(row.payload);
    setCodeType('static');
  };

  const saveCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const payload =
        codeType === 'temporary'
          ? customCode.trim() || buildTableShopUrl(merchantSlug, selected.id)
          : customCode.trim() || buildTableQrPayload(merchantSlug, selected.id);

      await api.post(`/merchant/floor-plans/tables/${selected.id}/qr-codes`, {
        codeType,
        code: payload,
        expiresInHours: codeType === 'temporary' ? 24 : undefined,
      });
      toast.success(t('tableQrSaved'));
      await loadQrCodes();
      await reload();
      setSelected(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tableQrSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/merchant/settings', { tableQrSettings: draftSettings });
      setQrSettings(draftSettings);
      toast.success(t('tableQrSettingsSaved'));
      setSettingsOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tableQrSettingsSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const downloadOne = async (row: TableQrView, style: QrDownloadStyle) => {
    try {
      const blob = await renderTableQrPng({
        payload: row.payload,
        tableLabel: row.label,
        style,
        settings: qrSettings,
      });
      downloadQrBlob(blob, tableQrDownloadFilename(row.label, style));
    } catch {
      toast.error(t('tableQrDownloadFailed'));
    }
  };

  const bulkDownload = async () => {
    setBusy(true);
    try {
      for (const row of filtered) {
        const blob = await renderTableQrPng({
          payload: row.payload,
          tableLabel: row.label,
          style: bulkStyle,
          settings: qrSettings,
        });
        downloadQrBlob(blob, tableQrDownloadFilename(row.label, bulkStyle));
        await new Promise((r) => setTimeout(r, 120));
      }
      toast.success(t('tableQrBulkDone'));
      setBulkOpen(false);
    } catch {
      toast.error(t('tableQrDownloadFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">{t('tableQrHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            onClick={() => {
              setDraftSettings(mergeTableQrSettings(qrSettings));
              setSettingsOpen(true);
            }}
          >
            <Settings2 className="h-4 w-4" />
            {t('tableQrStandSettings')}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 text-sm"
            disabled={!filtered.length}
            onClick={() => setBulkOpen(true)}
          >
            <Download className="h-4 w-4" />
            {t('tableQrBulkDownload')}
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
        <span>
          <span className="font-medium text-[var(--text-primary)]">{qrSettings.headerText}</span>
          {' · '}
          {qrSettings.subtitleText}
        </span>
        <span className="rounded bg-[var(--bg-subtle)] px-2 py-0.5">
          {t(`tableQrLayout_${qrSettings.layoutTemplate}`)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
        <aside className="card space-y-1">
          <button
            type="button"
            onClick={() => setActiveSectionId('all')}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
              activeSectionId === 'all'
                ? 'bg-emerald-600/15 font-semibold text-emerald-400'
                : 'hover:bg-[var(--bg-subtle)]'
            }`}
          >
            {t('tableSectionAll')}
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSectionId(s.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                activeSectionId === s.id
                  ? 'bg-emerald-600/15 font-semibold text-emerald-400'
                  : 'hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {s.name}
            </button>
          ))}
        </aside>

        {!filtered.length ? (
          <div className="card py-12 text-center text-sm text-[var(--text-muted)]">{t('tableNoTables')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openTable(row)}
                className="card flex flex-col items-center gap-2 py-4 text-center transition hover:ring-1 hover:ring-emerald-600/40"
              >
                <img src={row.qrUrl} alt="" className="h-20 w-20 rounded bg-white p-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{row.label}</span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Users className="h-3 w-3" />
                  {row.capacity}
                </span>
                {row.codes.some((c) => c.codeType === 'temporary') && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                    {t('tableQrTemporary')}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <QrCode className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-[var(--text-primary)]">
                {t('tableQrFor')} {selected.label}
              </h3>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-4">
                <img src={selected.qrUrl} alt="" className="h-40 w-40" />
                <span className="text-2xl font-bold text-gray-900">{selected.label}</span>
              </div>
              <p className="break-all text-xs text-[var(--text-muted)]">{selected.payload}</p>
              <p className="break-all text-xs text-[var(--text-muted)]">{selected.shopUrl}</p>

              <form onSubmit={saveCode} className="space-y-3 border-t border-[var(--border)] pt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                      codeType === 'static' ? 'bg-emerald-600 text-white' : 'btn-secondary'
                    }`}
                    onClick={() => setCodeType('static')}
                  >
                    {t('tableQrStatic')}
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                      codeType === 'temporary' ? 'bg-emerald-600 text-white' : 'btn-secondary'
                    }`}
                    onClick={() => setCodeType('temporary')}
                  >
                    {t('tableQrTemporary')}
                  </button>
                </div>
                <input
                  className="input text-sm"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder={t('tableQrCodePlaceholder')}
                />
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{t('tableQrDownloadStyle')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(['code_only', 'small', 'medium', 'large'] as QrDownloadStyle[]).map((style) => (
                      <button
                        key={style}
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => void downloadOne(selected, style)}
                      >
                        {t(`tableQrStyle_${style}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                    {t('cancel')}
                  </button>
                  <button type="submit" disabled={busy} className="btn-primary">
                    {t('save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Settings2 className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-[var(--text-primary)]">{t('tableQrStandSettings')}</h3>
            </div>
            <form onSubmit={saveSettings} className="space-y-4 p-4">
              <p className="text-xs text-[var(--text-muted)]">{t('tableQrStandSettingsHint')}</p>
              <label className="block text-sm">
                <span className="font-medium">{t('tableQrHeaderText')}</span>
                <input
                  className="input mt-1"
                  value={draftSettings.headerText}
                  maxLength={80}
                  onChange={(e) => setDraftSettings((s) => ({ ...s, headerText: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('tableQrSubtitleText')}</span>
                <input
                  className="input mt-1"
                  value={draftSettings.subtitleText}
                  maxLength={120}
                  onChange={(e) => setDraftSettings((s) => ({ ...s, subtitleText: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('tableQrLayoutTemplate')}</span>
                <select
                  className="input mt-1"
                  value={draftSettings.layoutTemplate}
                  onChange={(e) =>
                    setDraftSettings((s) => ({ ...s, layoutTemplate: e.target.value as QrLayoutTemplate }))
                  }
                >
                  {QR_LAYOUT_TEMPLATES.map((layout) => (
                    <option key={layout} value={layout}>
                      {t(`tableQrLayout_${layout}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={busy} className="btn-primary inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">{t('tableQrBulkDownload')}</h3>
            <label className="mb-3 block text-sm">
              <span className="font-medium">{t('tableQrDownloadStyle')}</span>
              <select
                className="input mt-1"
                value={bulkStyle}
                onChange={(e) => setBulkStyle(e.target.value as QrDownloadStyle)}
              >
                <option value="code_only">{t('tableQrStyle_code_only')}</option>
                <option value="small">{t('tableQrStyle_small')}</option>
                <option value="medium">{t('tableQrStyle_medium')}</option>
                <option value="large">{t('tableQrStyle_large')}</option>
              </select>
            </label>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              {filtered.length} {t('tables')} — {t('tableQrBulkHint')}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setBulkOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" disabled={busy} className="btn-primary" onClick={() => void bulkDownload()}>
                {t('download')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
