import { useEffect } from 'react';
import { resolvePanelAppOrigin } from '@/lib/brand';

/** Shop/custom-domain hosts have no panel login — send staff to the panel app (app.chaslay.com / app.rebornsense.com). */
export default function PanelLoginRedirect() {
  useEffect(() => {
    const target = `${resolvePanelAppOrigin()}/login${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 text-center text-sm text-stone-600">
      Redirecting to sign in…
    </div>
  );
}
