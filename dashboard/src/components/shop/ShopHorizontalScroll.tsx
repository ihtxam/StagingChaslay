import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  children: ReactNode;
  className?: string;
  /** Auto-advance the row (used for popular items). Pauses on hover/touch. */
  autoSlide?: boolean;
};

/** Hidden scrollbar row; left/right arrows appear on hover (Deliverect-style). */
export default function ShopHorizontalScroll({
  children,
  className = '',
  autoSlide = false,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(260, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!autoSlide || hovered || touching) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tick = () => {
      const el = trackRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 8) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 12;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const step = Math.max(280, Math.round(el.clientWidth * 0.6));
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    };

    const id = window.setInterval(tick, 3200);
    return () => window.clearInterval(id);
  }, [autoSlide, hovered, touching]);

  return (
    <div
      className={`shop-horizontal-scroll ${className}`.trim()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
    >
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1)}
        className={`shop-horizontal-scroll__btn shop-horizontal-scroll__btn--left${
          hovered ? ' is-visible' : ''
        }`}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2} />
      </button>
      <div ref={trackRef} className="shop-horizontal-scroll__track">
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(1)}
        className={`shop-horizontal-scroll__btn shop-horizontal-scroll__btn--right${
          hovered ? ' is-visible' : ''
        }`}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}
