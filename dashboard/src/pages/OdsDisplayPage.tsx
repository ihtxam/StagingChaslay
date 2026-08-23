import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type OdsTheme = 'light' | 'teal' | 'dark';

type BoardResponse = {
  display?: { name?: string; theme?: OdsTheme };
  preparing?: string[];
  ready?: string[];
};

const THEME_STYLES: Record<
  OdsTheme,
  {
    page: string;
    divider: string;
    title: string;
    preparingBox: string;
    preparingText: string;
    readyBox: string;
    readyText: string;
    readyHeroBox: string;
    readyHeroText: string;
  }
> = {
  light: {
    page: 'bg-white text-slate-900',
    divider: 'bg-slate-200',
    title: 'text-slate-900',
    preparingBox: 'border border-slate-200 bg-white',
    preparingText: 'text-slate-800',
    readyBox: 'bg-teal-500',
    readyText: 'text-white',
    readyHeroBox: 'bg-teal-500',
    readyHeroText: 'text-white',
  },
  teal: {
    page: 'bg-teal-50 text-teal-950',
    divider: 'bg-teal-200',
    title: 'text-teal-950',
    preparingBox: 'border border-teal-200 bg-white/90',
    preparingText: 'text-teal-900',
    readyBox: 'bg-teal-600',
    readyText: 'text-white',
    readyHeroBox: 'bg-teal-600',
    readyHeroText: 'text-white',
  },
  dark: {
    page: 'bg-slate-950 text-white',
    divider: 'bg-slate-700',
    title: 'text-white',
    preparingBox: 'border border-slate-700 bg-slate-900',
    preparingText: 'text-slate-100',
    readyBox: 'bg-emerald-500',
    readyText: 'text-white',
    readyHeroBox: 'bg-emerald-500',
    readyHeroText: 'text-white',
  },
};

function playReadyChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    /* ignore */
  }
}

export default function OdsDisplayPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [preparing, setPreparing] = useState<string[]>([]);
  const [ready, setReady] = useState<string[]>([]);
  const [theme, setTheme] = useState<OdsTheme>('light');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const knownReady = useRef(new Set<string>());
  const initialLoad = useRef(true);

  const styles = THEME_STYLES[theme] ?? THEME_STYLES.light;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/ods/${encodeURIComponent(token)}/board`);
      const data = res.data as BoardResponse;
      const prep = (data.preparing || []).map(String);
      const rdy = (data.ready || []).map(String);
      if (!initialLoad.current) {
        for (const num of rdy) {
          if (!knownReady.current.has(num)) {
            knownReady.current.add(num);
            playReadyChime();
          }
        }
      } else {
        for (const num of rdy) knownReady.current.add(num);
        initialLoad.current = false;
      }
      setPreparing(prep);
      setReady(rdy);
      setTheme((data.display?.theme as OdsTheme) || 'light');
      setDisplayName(data.display?.name || '');
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || t('odsLoadFailed'));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const heroReady = ready[0] || null;
  const otherReady = useMemo(() => ready.slice(1), [ready]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-center text-lg text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${styles.page}`}>
      <div className="grid min-h-screen grid-cols-[2fr_1px_1fr]">
        <section className="flex flex-col p-8 md:p-12">
          <h1 className={`text-4xl font-bold tracking-tight md:text-5xl ${styles.title}`}>
            {t('odsBeingPrepared')}
          </h1>
          <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:gap-5">
            {preparing.map((num) => (
              <div
                key={num}
                className={`flex aspect-[4/3] items-center justify-center rounded-md ${styles.preparingBox}`}
              >
                <span className={`text-3xl font-semibold md:text-4xl ${styles.preparingText}`}>
                  {num}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className={`${styles.divider}`} aria-hidden />

        <section className="flex flex-col p-8 md:p-12">
          <h1 className={`text-4xl font-bold tracking-tight md:text-5xl ${styles.title}`}>
            {t('odsReadyForPickup')}
          </h1>
          <div className="mt-8 flex flex-1 flex-col gap-4">
            {heroReady ? (
              <div
                className={`flex min-h-[40vh] flex-1 items-center justify-center rounded-lg ${styles.readyHeroBox}`}
              >
                <span className={`text-7xl font-bold md:text-8xl lg:text-9xl ${styles.readyHeroText}`}>
                  {heroReady}
                </span>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center opacity-40">
                <p className="text-xl">{t('odsNoReadyOrders')}</p>
              </div>
            )}
            {otherReady.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {otherReady.map((num) => (
                  <div
                    key={num}
                    className={`flex aspect-[5/3] items-center justify-center rounded-md ${styles.readyBox}`}
                  >
                    <span className={`text-4xl font-bold md:text-5xl ${styles.readyText}`}>{num}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {displayName ? (
        <p className="pointer-events-none fixed bottom-3 right-4 text-xs opacity-30">{displayName}</p>
      ) : null}
    </div>
  );
}
