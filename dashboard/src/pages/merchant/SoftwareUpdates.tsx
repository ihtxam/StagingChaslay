import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export type SoftwareRelease = {
  id: string;
  version: string;
  title: string;
  body: string;
  product: string;
  isPublished?: boolean;
  publishedAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SoftwareUpdates() {
  const { t } = useI18n();
  const [releases, setReleases] = useState<SoftwareRelease[]>([]);
  const [latest, setLatest] = useState<SoftwareRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/merchant/software-releases')
      .then((res) => {
        if (cancelled) return;
        setLatest(res.data.latest || null);
        setReleases(res.data.releases || []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            t('softwareUpdatesLoadFailed')
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="rounded-2xl border border-stone-200 bg-white px-5 py-5 dark:border-stone-700 dark:bg-stone-900">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-800">
          <Sparkles className="h-3.5 w-3.5" />
          {t('softwareUpdatesNav')}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          {t('softwareUpdatesTitle')}
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{t('softwareUpdatesHint')}</p>
        {latest ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-900 dark:bg-rose-950/60 dark:text-rose-100">
            {t('softwareUpdatesLatest')}: v{latest.version}
          </p>
        ) : null}
      </header>

      {loading ? (
        <p className="py-8 text-center text-sm text-stone-500">{t('loading')}</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : !releases.length ? (
        <p className="rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-900">
          {t('softwareUpdatesEmpty')}
        </p>
      ) : (
        <ol className="space-y-3">
          {releases.map((release, idx) => (
            <li
              key={release.id}
              className="rounded-2xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-700 dark:bg-stone-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-stone-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900">
                  v{release.version}
                </span>
                {idx === 0 ? (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {t('softwareUpdatesLatest')}
                  </span>
                ) : null}
                <span className="text-xs text-stone-400">{formatDate(release.publishedAt)}</span>
              </div>
              <h2 className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-100">
                {release.title}
              </h2>
              {release.body ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                  {release.body}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
