import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { readKioskLaunchToken } from '@/lib/kiosk-pwa';

/** Resolves /kiosk/ PWA start_url to the last-used kiosk token. */
export default function KioskLaunchRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = readKioskLaunchToken();
    if (token) {
      navigate(`/kiosk/${encodeURIComponent(token)}`, { replace: true });
      return;
    }
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 text-white">
      <p className="text-lg font-medium">Opening kiosk…</p>
    </div>
  );
}
