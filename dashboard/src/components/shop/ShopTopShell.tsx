import { useEffect, useRef, type ReactNode } from 'react';

/** Sticky shop header shell; keeps `--shop-header-height` in sync for sticky menu bars. */
export default function ShopTopShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty('--shop-header-height', `${el.offsetHeight}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--shop-header-height');
    };
  }, []);

  return (
    <div ref={ref} className="shop-top-shell sticky top-0 z-[60] overflow-visible bg-white">
      {children}
    </div>
  );
}
