import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Hidden scrollbar row; left/right arrows appear on hover (Deliverect-style). */
export default function ShopHorizontalScroll({ children, className = '' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(260, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div
      className={`shop-horizontal-scroll ${className}`.trim()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
