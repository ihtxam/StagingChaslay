import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type AppRelease = {
  version: string;
  filename: string;
  downloadUrl: string | null;
  sizeBytes: number;
  builtAt: string | null;
  isLatest: boolean;
  signed: boolean | null;
  platform: 'android' | 'windows';
};

type AppProductHistory = {
  id: string;
  name: string;
  platform: 'android' | 'windows';
  currentVersion: string | null;
  latestFilename: string | null;
  latestAvailable: boolean;
  releases: AppRelease[];
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AppDownloads() {
  const { t, formatDateTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<AppProductHistory[]>([]);

  const productTitle = (product: AppProductHistory) => {
    if (product.id === 'print-bridge') return t('appDownloadsProductBridge');
    if (product.id === 'pos-android') return t('appDownloadsProductPosAndroid');
    if (product.id === 'pos-windows') return t('appDownloadsProductPos');
    if (product.id === 'print-agent') return t('appDownloadsProductAgent');
    return product.name;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/app-downloads');
      setProducts(res.data.products || []);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('appDownloadsLoadFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{t('appDownloadsTitle')}</h1>
          <p className="text-sm text-stone-600 mt-1">{t('appDownloadsHint')}</p>
        </div>
        <button type="button" className="btn-secondary text-sm shrink-0" onClick={() => void load()}>
          {t('refresh')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-500">{t('loading')}</div>
      ) : products.length === 0 ? (
        <div className="card text-sm text-stone-600">{t('appDownloadsEmpty')}</div>
      ) : (
        products.map((product) => (
          <section key={product.id} className="card !p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
              <h2 className="text-base font-semibold text-stone-900">{productTitle(product)}</h2>
              <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-stone-200 text-stone-700">
                {product.platform === 'android' ? t('appDownloadsAndroid') : t('appDownloadsWindows')}
              </span>
              {product.currentVersion ? (
                <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800">
                  {t('appDownloadsCurrent')} {product.currentVersion}
                </span>
              ) : null}
            </div>
            <div className="table-scroll overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white text-left text-stone-600">
                  <tr>
                    <th className="px-3 py-2">{t('appDownloadsVersion')}</th>
                    <th className="px-3 py-2">{t('appDownloadsPlatform')}</th>
                    <th className="px-3 py-2">{t('appDownloadsBuilt')}</th>
                    <th className="px-3 py-2">{t('appDownloadsSize')}</th>
                    <th className="px-3 py-2">{t('appDownloadsFile')}</th>
                    <th className="px-3 py-2">{t('download')}</th>
                  </tr>
                </thead>
                <tbody>
                  {product.releases.length ? (
                    product.releases.map((release) => (
                      <tr
                        key={`${product.id}-${release.version}-${release.filename}`}
                        className={`border-t border-stone-100 ${release.isLatest ? 'bg-emerald-50/70' : ''}`}
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {release.version}
                          {release.isLatest ? (
                            <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-emerald-600 text-white">
                              {t('appDownloadsLatest')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-stone-600">
                          {release.platform === 'android' ? t('appDownloadsAndroid') : t('appDownloadsWindows')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-500">
                          {release.builtAt ? formatDateTime(release.builtAt) : t('appDownloadsUnknownDate')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-stone-600">
                          {formatBytes(release.sizeBytes)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">{release.filename}</td>
                        <td className="px-3 py-2">
                          {release.downloadUrl ? (
                            <a
                              href={release.downloadUrl}
                              className="text-teal-700 font-semibold hover:underline"
                            >
                              {t('download')}
                            </a>
                          ) : (
                            <span className="text-stone-400">{t('appDownloadsUnavailable')}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                        {t('appDownloadsEmpty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
