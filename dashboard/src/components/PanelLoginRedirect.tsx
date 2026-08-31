import { useEffect } from 'react';

const PANEL_APP =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  `https://app.${(import.meta.env.VITE_PUBLIC_DOMAIN || 'rebornsense.com').toLowerCase()}`;

/** Shop/custom-domain hosts have no panel login — send staff to app.rebornsense.com. */
export default function PanelLoginRedirect() {
  useEffect(() => {
    const target = `${PANEL_APP}/login${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 text-center text-sm text-stone-600">
      Redirecting to sign in…
    </div>
  );
}
