import { useEffect, useMemo, useState } from 'react';
import type { KioskPromoSlide } from '@/lib/kiosk-api';
import { useI18n } from '@/lib/i18n';

type Props = {
  slides: KioskPromoSlide[];
  intervalSec?: number;
  merchantName?: string;
  /** When cart is empty promos can use the full width. */
  fullWidth?: boolean;
  className?: string;
};

export default function CdsPromoSlider({
  slides,
  intervalSec = 8,
  merchantName,
  fullWidth = false,
  className = '',
}: Props) {
  const { t } = useI18n();
  const items = useMemo(() => {
    if (slides.length) return slides;
    return [
      {
        title: merchantName || t('cdsWelcomeTitle'),
        subtitle: t('cdsWelcomeSubtitle'),
      },
    ];
  }, [slides, merchantName, t]);

  const [index, setIndex] = useState(0);
  const active = items[index % items.length];

  useEffect(() => {
    if (items.length <= 1) return;
    const ms = Math.max(3000, Math.round(intervalSec * 1000));
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [items.length, intervalSec]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white ${
        fullWidth ? 'min-h-[40vh]' : 'h-full min-h-[20rem]'
      } ${className}`}
    >
      {active.imageUrl ? (
        <img
          src={active.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div
        className={`absolute inset-0 ${
          active.imageUrl ? 'bg-black/45' : 'bg-gradient-to-br from-teal-700/90 to-slate-900/95'
        }`}
      />
      <div className="relative flex h-full flex-col justify-end p-6 md:p-10">
        {active.overlayText ? (
          <p className="mb-3 text-3xl font-black uppercase tracking-wide md:text-5xl">
            {active.overlayText}
          </p>
        ) : null}
        {active.title ? (
          <h2 className="text-2xl font-bold leading-tight md:text-4xl">{active.title}</h2>
        ) : null}
        {active.subtitle ? (
          <p className="mt-2 max-w-xl text-base text-white/85 md:text-xl">{active.subtitle}</p>
        ) : null}
        {items.length > 1 ? (
          <div className="mt-6 flex gap-2">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i === index % items.length ? 'bg-white' : 'bg-white/35'}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
