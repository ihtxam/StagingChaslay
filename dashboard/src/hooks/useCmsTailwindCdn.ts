import { useEffect } from 'react';

/** Inject Tailwind Play CDN for CMS static HTML fragments on hybrid homepage. */
export function useCmsTailwindCdn(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (document.getElementById('cms-tailwind-cdn')) return;
    const link = document.createElement('link');
    link.id = 'cms-tailwind-preconnect';
    link.rel = 'preconnect';
    link.href = 'https://cdn.tailwindcss.com';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.id = 'cms-tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }, [enabled]);
}
