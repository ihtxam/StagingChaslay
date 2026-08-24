import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type LogRow = {
  id: string;
  level: string;
  category: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  actorRole?: string | null;
  createdAt: string;
};

const LEVELS = ['', 'debug', 'info', 'warn', 'error'] as const;

export default function SystemLogs() {
  const { t, formatDateTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/system-logs', {
        params: { page, limit: 50, level: level || undefined, category: category || undefined },
      });
      setLogs(res.data.logs || []);
      setTotal(Number(res.data.total) || 0);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('platformLogsLoadFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [page, level, category, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const levelClass = (lv: string) => {
    if (lv === 'error') return 'text-red-700 bg-red-50';
    if (lv === 'warn') return 'text-amber-800 bg-amber-50';
    if (lv === 'info') return 'text-blue-800 bg-blue-50';
    return 'text-stone-600 bg-stone-100';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900">{t('platformSystemLogs')}</h1>
        <p className="text-sm text-stone-600 mt-1">{t('platformSystemLogsHint')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input text-sm w-auto" value={level} onChange={(e) => { setPage(1); setLevel(e.target.value); }}>
          {LEVELS.map((l) => (
            <option key={l || 'all'} value={l}>
              {l ? l.toUpperCase() : t('allLevels')}
            </option>
          ))}
        </select>
        <input
          className="input text-sm w-40"
          placeholder={t('category')}
          value={category}
          onChange={(e) => { setPage(1); setCategory(e.target.value); }}
        />
        <button
          type="button"
          className={`btn-secondary text-sm ${category === 'client_error' ? 'ring-2 ring-teal-500' : ''}`}
          onClick={() => { setPage(1); setCategory((c) => (c === 'client_error' ? '' : 'client_error')); }}
        >
          {t('platformClientErrors')}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => void load()}>
          {t('refresh')}
        </button>
      </div>

      <div className="card !p-0 table-scroll overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-3 py-2">{t('date')}</th>
              <th className="px-3 py-2">{t('level')}</th>
              <th className="px-3 py-2">{t('category')}</th>
              <th className="px-3 py-2">{t('message')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-stone-500">
                  {t('loading')}
                </td>
              </tr>
            ) : logs.length ? (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-500">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${levelClass(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-stone-600">{log.category}</td>
                  <td className="px-3 py-2 text-stone-800 max-w-xl">
                    <p>{log.message}</p>
                    {log.metadata && Object.keys(log.metadata).length ? (
                      <pre className="mt-1 text-[10px] text-stone-500 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-stone-500">
                  {t('platformNoLogs')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 50 ? (
        <div className="flex justify-center gap-2">
          <button type="button" className="btn-secondary text-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('previous')}
          </button>
          <span className="text-sm text-stone-500 self-center">
            {page} / {Math.ceil(total / 50)}
          </span>
          <button type="button" className="btn-secondary text-sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>
            {t('next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
