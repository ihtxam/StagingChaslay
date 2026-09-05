import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type OdsTheme = 'light' | 'teal' | 'dark';
type OdsLayout = 'columns' | 'rows';

type BoardResponse = {
  display?: { name?: string; theme?: OdsTheme; layout?: OdsLayout };
  preparing?: string[];
  ready?: string[];
};

const THEME_STYLES: Record<
  OdsTheme,
  { page: string; title: string; prepBox: string; readyBox: string }
> = {
  light: {
    page: 'bg-white text-slate-900',
    title: 'text-orange-500',
    prepBox: 'bg-blue-600',
    readyBox: 'bg-green-600',
  },
  teal: {
    page: 'bg-slate-50 text-slate-900',
    title: 'text-orange-500',
    prepBox: 'bg-blue-600',
    readyBox: 'bg-green-600',
  },
  dark: {
    page: 'bg-slate-950 text-white',
    title: 'text-orange-400',
    prepBox: 'bg-blue-500',
    readyBox: 'bg-green-500',
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

function NumberTile({
  num,
  boxClass,
  compact,
}: {
  num: string;
  boxClass: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-md text-white ${boxClass} ${
        compact ? 'min-h-[9vh] px-4 py-3' : 'min-h-[12vh] px-6 py-5'
      }`}
    >
      <span
        className={`font-extrabold tracking-tight ${
          compact ? 'text-4xl md:text-5xl' : 'text-5xl md:text-7xl'
        }`}
      >
        {num.replace(/^#/, '')}
      </span>
    </div>
  );
}

function OrderStack({
  numbers,
  boxClass,
  wrap,
}: {
  numbers: string[];
  boxClass: string;
  wrap?: boolean;
}) {
  const compact = numbers.length > 6;
  if (wrap) {
    return (
      <div className="mt-6 flex flex-1 flex-wrap content-start gap-3 overflow-y-auto">
        {numbers.map((num) => (
          <div key={num} className="min-w-[8rem] flex-1">
            <NumberTile num={num} boxClass={boxClass} compact={compact} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-1 flex-col gap-3 overflow-y-auto">
      {numbers.map((num) => (
        <NumberTile key={num} num={num} boxClass={boxClass} compact={compact} />
      ))}
    </div>
  );
}

export default function OdsDisplayPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [preparing, setPreparing] = useState<string[]>([]);
  const [ready, setReady] = useState<string[]>([]);
  const [theme, setTheme] = useState<OdsTheme>('light');
  const [layout, setLayout] = useState<OdsLayout>('columns');
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
      setLayout(data.display?.layout === 'rows' ? 'rows' : 'columns');
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

  const isRows = layout === 'rows';

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-center text-lg text-red-700">
        {error}
      </div>
    );
  }

  const prepSection = (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 md:p-10">
      <h1 className={`text-3xl font-extrabold uppercase tracking-wide md:text-5xl ${styles.title}`}>
        {t('odsBeingPrepared')}
      </h1>
      <OrderStack numbers={preparing} boxClass={styles.prepBox} wrap={isRows} />
    </section>
  );

  const readySection = (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 md:p-10">
      <h1 className={`text-3xl font-extrabold uppercase tracking-wide md:text-5xl ${styles.title}`}>
        {t('odsReadyForPickup')}
      </h1>
      {ready.length ? (
        <OrderStack numbers={ready} boxClass={styles.readyBox} wrap={isRows} />
      ) : (
        <div className="mt-6 flex flex-1 items-center justify-center opacity-40">
          <p className="text-xl">{t('odsNoReadyOrders')}</p>
        </div>
      )}
    </section>
  );

  return (
    <div className={`min-h-screen ${styles.page}`}>
      <div
        className={
          isRows
            ? 'grid min-h-screen grid-rows-2'
            : 'grid min-h-screen grid-cols-1 md:grid-cols-2'
        }
      >
        {prepSection}
        {readySection}
      </div>
      {displayName ? (
        <p className="pointer-events-none fixed bottom-3 right-4 text-xs opacity-30">{displayName}</p>
      ) : null}
    </div>
  );
}
