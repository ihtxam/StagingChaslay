import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { guidesForAudience, type GuideAudience } from '@/lib/product-guides';

export default function ProductGuidesPage({ audience }: { audience: GuideAudience }) {
  const { t } = useI18n();
  const chapters = useMemo(() => guidesForAudience(audience), [audience]);
  const [activeId, setActiveId] = useState(chapters[0]?.id || '');
  const active = chapters.find((c) => c.id === activeId) || chapters[0];

  const title = audience === 'reseller' ? t('resellerGuidesTitle') : t('productGuidesTitle');
  const subtitle = audience === 'reseller' ? t('resellerGuidesSubtitle') : t('productGuidesSubtitle');
  const otherPath = audience === 'reseller' ? '/reseller/support' : '/merchant/support';
  const otherLabel = t('support');

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl border border-stone-200 bg-white px-5 py-5">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-800">
          <BookOpen className="h-3.5 w-3.5" />
          {audience === 'reseller' ? t('resellerGuidesNav') : t('productGuidesNav')}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">{subtitle}</p>
        <p className="mt-3 text-sm text-stone-500">
          {t('productGuidesSupportHint')}{' '}
          <Link to={otherPath} className="font-semibold text-rose-800 underline underline-offset-2">
            {otherLabel}
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-2xl border border-stone-200 bg-white p-3 lg:sticky lg:top-4 lg:self-start">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            {t('productGuidesChapters')}
          </p>
          <nav className="space-y-1">
            {chapters.map((c, idx) => {
              const on = c.id === active?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-sm ${
                    on ? 'bg-rose-50 font-semibold text-rose-950' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <span className="mt-0.5 w-5 shrink-0 text-[11px] tabular-nums text-stone-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span>{c.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {active ? (
          <article className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              {active.summary}
            </p>
            <h2 className="mt-1 text-xl font-bold text-stone-900">{active.title}</h2>
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <span className="font-semibold">{t('productGuidesYouWill')}: </span>
              {active.outcome}
            </p>
            <ol className="mt-5 space-y-4">
              {active.steps.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-stone-900">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {t('productGuidesDoneHint')}
            </p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
