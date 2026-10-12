import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type PublishedPr = {
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  author: string;
  baseBranch: string;
  mergedAt: string;
};

type DayGroup = {
  date: string;
  prs: PublishedPr[];
};

const DAY_OPTIONS = [7, 30, 90, 0] as const;

export default function PublishedPrsAdmin() {
  const { t, formatDate, formatDateTime } = useI18n();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState(30);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [repo, setRepo] = useState('ihtxam/rebornSense');
  const [token, setToken] = useState('');
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [tokenMasked, setTokenMasked] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [openPr, setOpenPr] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/published-prs', { params: { days } });
      setGroups(res.data.groups || []);
      setTotal(Number(res.data.total) || 0);
      setRepo(res.data.repo || 'ihtxam/rebornSense');
      setTokenConfigured(!!res.data.tokenConfigured);
      setTokenMasked(res.data.tokenMasked || '');
      setSyncedAt(res.data.syncedAt || null);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('publishedPrsLoadFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      await api.post('/superadmin/published-prs/sync', {
        repo,
        token: token.trim() || undefined,
      });
      setToken('');
      toast.success(t('publishedPrsSynced'));
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('publishedPrsSyncFailed')
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{t('publishedPrsTitle')}</h1>
          <p className="mt-1 text-sm text-stone-600">{t('publishedPrsHint')}</p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={syncing}
          onClick={() => void sync()}
        >
          {syncing ? t('saving') : t('publishedPrsRefresh')}
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            {t('publishedPrsRange')}
            <select
              className="input mt-1"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? t('publishedPrsRangeAll') : t('publishedPrsRangeDays', { n: value })}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t('publishedPrsRepo')}
            <input
              className="input mt-1"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            {t('publishedPrsToken')}
            <input
              className="input mt-1"
              type="password"
              autoComplete="off"
              placeholder={tokenConfigured ? tokenMasked : t('publishedPrsTokenHint')}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-stone-500">
          {syncedAt
            ? t('publishedPrsLastSync', { time: formatDateTime(syncedAt) })
            : t('publishedPrsNeverSynced')}
          {` · ${total} ${t('publishedPrsCount')}`}
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="card py-10 text-center text-sm text-stone-500">{t('loading')}</div>
        ) : !groups.length ? (
          <div className="card py-10 text-center text-sm text-stone-500">{t('publishedPrsEmpty')}</div>
        ) : (
          groups.map((group) => (
            <section key={group.date} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <header className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3">
                <h2 className="font-semibold text-stone-900">
                  {formatDate(`${group.date}T12:00:00`)}
                </h2>
                <span className="text-xs font-medium text-stone-500">
                  {group.prs.length} {t('publishedPrsCount')}
                </span>
              </header>
              <ul className="divide-y divide-stone-100">
                {group.prs.map((pr) => {
                  const open = openPr === pr.number;
                  return (
                    <li key={pr.number} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => setOpenPr(open ? null : pr.number)}
                        >
                          <p className="text-sm font-semibold text-stone-900">
                            <span className="mr-2 font-mono text-teal-800">#{pr.number}</span>
                            {pr.title}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {formatDateTime(pr.mergedAt)}
                            {pr.author ? ` · ${pr.author}` : ''}
                            {pr.baseBranch ? ` · ${pr.baseBranch}` : ''}
                          </p>
                        </button>
                        {pr.htmlUrl ? (
                          <a
                            href={pr.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-teal-800 hover:underline"
                          >
                            {t('publishedPrsOpen')}
                          </a>
                        ) : null}
                      </div>
                      {open && pr.body ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-700">
                          {pr.body}
                        </pre>
                      ) : null}
                      {open && !pr.body ? (
                        <p className="mt-2 text-xs text-stone-400">{t('publishedPrsNoDetails')}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
