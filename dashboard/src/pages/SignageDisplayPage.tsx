import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type MenuProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
};

type MenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  products: MenuProduct[];
};

type PlayerSlide = {
  id: string;
  type: 'menu' | 'image' | 'image_text';
  durationSec: number;
  categoryIds: string[];
  headline?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  showPrices: boolean;
  showPhotos: boolean;
};

type PlayerPayload = {
  screen: { id: string; name: string; orientation: 'landscape' | 'portrait'; template: string };
  merchant: { name: string; logoUrl?: string | null };
  playlist: { id: string; name: string } | null;
  slides: PlayerSlide[];
  menu: { categories: MenuCategory[] };
  currency: string;
};

const API_ORIGIN = String(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatPrice(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: currency || 'CHF' }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || 'CHF'}`;
  }
}

function themeClass(template: string): string {
  switch (template) {
    case 'kebab_green':
      return 'signage-kebab';
    case 'cafe_cream':
      return 'signage-cafe';
    case 'portrait_poster':
      return 'signage-poster';
    case 'lunch_special':
      return 'signage-lunch';
    default:
      return 'signage-pizza';
  }
}

function msUntilNext4amZurich(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  const minutesNow = h * 60 + m;
  const target = 4 * 60;
  let diff = target - minutesNow;
  if (diff <= 2) diff += 24 * 60;
  return diff * 60 * 1000;
}

export default function SignageDisplayPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState<PlayerPayload | null>(null);
  const [error, setError] = useState('');
  const [slideIdx, setSlideIdx] = useState(0);
  const pollRef = useRef<number | null>(null);
  const slideTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicApi.get(`/tv/${encodeURIComponent(token)}`);
      const payload = res.data as PlayerPayload;
      setData(payload);
      setError('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || t('signagePlayerInvalid'));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
    pollRef.current = window.setInterval(() => {
      void load();
    }, 45000);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    const delay = msUntilNext4amZurich();
    const id = window.setTimeout(() => {
      window.location.reload();
    }, delay);
    return () => window.clearTimeout(id);
  }, []);

  const slides = data?.slides || [];
  const current = slides[slideIdx] || slides[0] || null;

  useEffect(() => {
    if (slideTimer.current != null) window.clearTimeout(slideTimer.current);
    if (!slides.length) return undefined;
    const ms = Math.max(5, current?.durationSec || 10) * 1000;
    slideTimer.current = window.setTimeout(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, ms);
    return () => {
      if (slideTimer.current != null) window.clearTimeout(slideTimer.current);
    };
  }, [slides, current, slideIdx]);

  useEffect(() => {
    if (slides.length && slideIdx >= slides.length) setSlideIdx(0);
  }, [slides.length, slideIdx]);

  const categoriesForSlide = useMemo(() => {
    if (!data || !current || current.type !== 'menu') return [];
    const ids = current.categoryIds || [];
    if (!ids.length) return data.menu.categories;
    return data.menu.categories.filter((c) => ids.includes(c.id));
  }, [data, current]);

  const portrait = data?.screen.orientation === 'portrait';
  const theme = themeClass(data?.screen.template || 'dark_pizza');

  return (
    <div className={`signage-shell ${theme} ${portrait ? 'signage-portrait' : 'signage-landscape'}`}>
      <style>{SIGNAGE_CSS}</style>
      {error ? (
        <div className="signage-empty">
          <p>{error}</p>
        </div>
      ) : !data ? (
        <div className="signage-empty">
          <p>{t('loading')}</p>
        </div>
      ) : !current ? (
        <div className="signage-empty">
          <h1>{data.merchant.name}</h1>
          <p>{t('signagePlayerEmpty')}</p>
        </div>
      ) : (
        <div className="signage-frame">
          <header className="signage-top">
            <div className="signage-brand">
              {data.merchant.logoUrl ? (
                <img src={mediaUrl(data.merchant.logoUrl)} alt="" />
              ) : null}
              <div>
                <p className="signage-kicker">{data.screen.name}</p>
                <h1>{data.merchant.name}</h1>
              </div>
            </div>
          </header>
          <main className="signage-main">
            {current.type === 'menu' ? (
              <div className="signage-menu">
                {categoriesForSlide.map((cat) => (
                  <section key={cat.id} className="signage-cat">
                    <h2>{cat.name}</h2>
                    <ul>
                      {cat.products.map((p) => (
                        <li key={p.id}>
                          {current.showPhotos && p.imageUrl ? (
                            <img src={mediaUrl(p.imageUrl)} alt="" />
                          ) : null}
                          <div className="signage-item-copy">
                            <span className="signage-item-name">{p.name}</span>
                            {p.description ? <span className="signage-item-desc">{p.description}</span> : null}
                          </div>
                          {current.showPrices ? (
                            <span className="signage-price">{formatPrice(p.price, data.currency)}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className={`signage-promo ${current.type === 'image' ? 'signage-promo-full' : ''}`}>
                {current.imageUrl ? <img src={mediaUrl(current.imageUrl)} alt="" /> : null}
                {current.type === 'image_text' || !current.imageUrl ? (
                  <div className="signage-promo-copy">
                    {current.headline ? <h2>{current.headline}</h2> : null}
                    {current.body ? <p>{current.body}</p> : null}
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

const SIGNAGE_CSS = `
.signage-shell { min-height: 100dvh; overflow: hidden; font-family: ui-sans-serif, system-ui, sans-serif; }
.signage-landscape { aspect-ratio: 16/9; }
.signage-portrait { aspect-ratio: 9/16; max-width: 56dvh; margin: 0 auto; }
.signage-frame { min-height: 100dvh; display: flex; flex-direction: column; }
.signage-top { padding: 1.25rem 1.75rem; display: flex; align-items: center; }
.signage-brand { display: flex; align-items: center; gap: 1rem; }
.signage-brand img { height: 3rem; width: auto; object-fit: contain; }
.signage-kicker { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.7; margin: 0; }
.signage-top h1 { margin: 0; font-size: clamp(1.4rem, 3vw, 2.4rem); font-weight: 800; }
.signage-main { flex: 1; padding: 0 1.75rem 1.75rem; overflow: hidden; }
.signage-menu { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
.signage-cat h2 { margin: 0 0 0.75rem; font-size: clamp(1.2rem, 2.4vw, 2rem); }
.signage-cat ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.signage-cat li { display: flex; align-items: center; gap: 0.75rem; }
.signage-cat li img { width: 3.2rem; height: 3.2rem; object-fit: cover; border-radius: 0.5rem; flex-shrink: 0; }
.signage-item-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.signage-item-name { font-weight: 700; font-size: clamp(0.95rem, 1.6vw, 1.25rem); }
.signage-item-desc { font-size: 0.8rem; opacity: 0.75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.signage-price { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.signage-promo { position: relative; height: calc(100dvh - 6rem); border-radius: 1.25rem; overflow: hidden; }
.signage-promo img { width: 100%; height: 100%; object-fit: cover; }
.signage-promo-copy { position: absolute; inset: auto 0 0 0; padding: 2rem; background: linear-gradient(transparent, rgba(0,0,0,0.72)); color: #fff; }
.signage-promo-copy h2 { margin: 0 0 0.4rem; font-size: clamp(2rem, 5vw, 4rem); }
.signage-promo-copy p { margin: 0; font-size: clamp(1rem, 2vw, 1.5rem); max-width: 40rem; }
.signage-empty { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 2rem; text-align: center; }
.signage-pizza { background: #120c0a; color: #f8f4ef; }
.signage-pizza .signage-kicker { color: #e11d48; }
.signage-pizza .signage-cat h2 { color: #fb7185; }
.signage-pizza .signage-price { color: #fecdd3; }
.signage-kebab { background: #052e16; color: #ecfdf5; }
.signage-kebab .signage-kicker, .signage-kebab .signage-price { color: #fbbf24; }
.signage-kebab .signage-cat h2 { color: #86efac; }
.signage-cafe { background: #f4efe6; color: #3f2e22; }
.signage-cafe .signage-kicker { color: #a16207; }
.signage-cafe .signage-cat h2 { color: #7c2d12; }
.signage-cafe .signage-price { color: #92400e; }
.signage-poster { background: #0b1220; color: #f8fafc; }
.signage-poster .signage-menu { grid-template-columns: 1fr; }
.signage-poster .signage-cat li img { width: 5rem; height: 5rem; }
.signage-poster .signage-item-name { font-size: 1.4rem; }
.signage-lunch { background: #111827; color: #fff7ed; }
.signage-lunch .signage-kicker, .signage-lunch .signage-price { color: #facc15; }
.signage-lunch .signage-cat h2 { color: #fdba74; }
.signage-lunch .signage-cat li { background: rgba(250,204,21,0.08); border-radius: 0.75rem; padding: 0.5rem 0.7rem; }
`;
